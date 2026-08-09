import { LifecycleStatus, MenuStatus, MembershipRole, Prisma } from '@prisma/client';
import type { MenuPublication, PrismaClient } from '@prisma/client';

export type MenuSnapshot = Prisma.InputJsonObject;

export interface MenuSnapshotInput {
  transaction: Prisma.TransactionClient;
  menuId: string;
  organizationId: string;
}

export interface MenuSnapshotSource {
  buildSnapshot(input: MenuSnapshotInput): Promise<MenuSnapshot>;
}

export interface PublicationTenantContext {
  organizationId: string;
  userId: string;
  establishmentIds?: readonly string[];
}

export interface PublishMenuInput {
  menuId: string;
  tenant: PublicationTenantContext;
  idempotencyKey: string;
}

export type MenuPublicationErrorCode =
  'IDEMPOTENCY_KEY_INVALID' | 'PUBLICATION_ACCESS_DENIED' | 'MENU_NOT_FOUND' | 'MENU_ARCHIVED';

export interface PublicationQueryInput {
  menuId: string;
  tenant: PublicationTenantContext;
}

export class MenuPublicationServiceError extends Error {
  constructor(
    public readonly code: MenuPublicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MenuPublicationServiceError';
  }
}

export class MenuPublicationService {
  constructor(
    private readonly database: PrismaClient,
    private readonly snapshotSource: MenuSnapshotSource,
  ) {}

  async publish(input: PublishMenuInput): Promise<MenuPublication> {
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length === 0 || idempotencyKey.length > 128) {
      throw new MenuPublicationServiceError(
        'IDEMPOTENCY_KEY_INVALID',
        'A chave de idempotência deve ter entre 1 e 128 caracteres.',
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.database.$transaction(
          async (transaction) => {
            await this.assertPublisher(transaction, input.tenant);

            const lockedMenus = await transaction.$queryRaw<
              Array<{
                id: string;
                status: MenuStatus;
                establishment_id: string;
                establishment_status: LifecycleStatus;
              }>
            >`
            SELECT m."id", m."status", m."establishment_id", e."status" AS "establishment_status"
            FROM "menus" AS m
            INNER JOIN "establishments" AS e
              ON e."id" = m."establishment_id"
             AND e."organization_id" = m."organization_id"
            WHERE m."id" = ${input.menuId}::uuid
              AND m."organization_id" = ${input.tenant.organizationId}::uuid
            FOR UPDATE OF m, e
          `;
            const menu = lockedMenus[0];
            if (!menu || !this.hasEstablishmentAccess(input.tenant, menu.establishment_id)) {
              throw new MenuPublicationServiceError(
                'MENU_NOT_FOUND',
                'O menu não foi encontrado neste tenant.',
              );
            }
            if (menu.establishment_status !== LifecycleStatus.ACTIVE) {
              throw new MenuPublicationServiceError(
                'MENU_NOT_FOUND',
                'O menu não está disponível neste tenant.',
              );
            }
            if (menu.status === MenuStatus.ARCHIVED) {
              throw new MenuPublicationServiceError(
                'MENU_ARCHIVED',
                'Menus arquivados não podem receber novas publicações.',
              );
            }

            const existingPublication = await transaction.menuPublication.findUnique({
              where: {
                menuId_idempotencyKey: {
                  menuId: input.menuId,
                  idempotencyKey,
                },
              },
            });
            if (existingPublication) return existingPublication;

            const snapshot = await this.snapshotSource.buildSnapshot({
              transaction,
              menuId: input.menuId,
              organizationId: input.tenant.organizationId,
            });
            const latestPublication = await transaction.menuPublication.aggregate({
              where: { menuId: input.menuId, organizationId: input.tenant.organizationId },
              _max: { version: true },
            });
            const version = (latestPublication._max.version ?? 0) + 1;

            const publication = await transaction.menuPublication.create({
              data: {
                organizationId: input.tenant.organizationId,
                menuId: input.menuId,
                version,
                snapshot,
                publishedBy: input.tenant.userId,
                idempotencyKey,
              },
            });

            const activation = await transaction.menu.updateMany({
              where: {
                id: input.menuId,
                organizationId: input.tenant.organizationId,
              },
              data: {
                activePublicationId: publication.id,
                status: MenuStatus.ACTIVE,
              },
            });
            if (activation.count !== 1) {
              throw new MenuPublicationServiceError(
                'MENU_NOT_FOUND',
                'O menu deixou de existir durante a publicação.',
              );
            }

            return publication;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryablePublicationError(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new Error('Publication transaction exhausted its retry attempts.');
  }

  async getActive(input: PublicationQueryInput): Promise<MenuPublication | null> {
    await this.assertReader(this.database, input.tenant);
    const menu = await this.findScopedMenu(this.database, input);
    if (!menu.activePublicationId) return null;
    return this.database.menuPublication.findFirst({
      where: {
        id: menu.activePublicationId,
        organizationId: input.tenant.organizationId,
        menuId: input.menuId,
      },
    });
  }

  async listHistory(input: PublicationQueryInput): Promise<MenuPublication[]> {
    await this.assertReader(this.database, input.tenant);
    await this.findScopedMenu(this.database, input);
    return this.database.menuPublication.findMany({
      where: { menuId: input.menuId, organizationId: input.tenant.organizationId },
      orderBy: { version: 'desc' },
      take: 100,
    });
  }

  private async assertPublisher(
    database: Prisma.TransactionClient,
    tenant: PublicationTenantContext,
  ): Promise<void> {
    const membership = await database.membership.findFirst({
      where: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        status: LifecycleStatus.ACTIVE,
        role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
        organization: { status: LifecycleStatus.ACTIVE },
        user: { status: LifecycleStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new MenuPublicationServiceError(
        'PUBLICATION_ACCESS_DENIED',
        'O usuário não pode publicar neste tenant.',
      );
    }
  }

  private async assertReader(
    database: PrismaClient,
    tenant: PublicationTenantContext,
  ): Promise<void> {
    const membership = await database.membership.findFirst({
      where: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        status: LifecycleStatus.ACTIVE,
        organization: { status: LifecycleStatus.ACTIVE },
        user: { status: LifecycleStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new MenuPublicationServiceError(
        'PUBLICATION_ACCESS_DENIED',
        'O usuário não pode consultar publicações neste tenant.',
      );
    }
  }

  private async findScopedMenu(
    database: PrismaClient,
    input: PublicationQueryInput,
  ): Promise<{ activePublicationId: string | null; establishmentId: string }> {
    const menu = await database.menu.findFirst({
      where: { id: input.menuId, organizationId: input.tenant.organizationId },
      select: { activePublicationId: true, establishmentId: true },
    });
    if (!menu || !this.hasEstablishmentAccess(input.tenant, menu.establishmentId)) {
      throw new MenuPublicationServiceError(
        'MENU_NOT_FOUND',
        'O menu não foi encontrado neste tenant.',
      );
    }
    return menu;
  }

  private hasEstablishmentAccess(
    tenant: PublicationTenantContext,
    establishmentId: string,
  ): boolean {
    return !tenant.establishmentIds || tenant.establishmentIds.includes(establishmentId);
  }
}

function isRetryablePublicationError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'P2002' || code === 'P2034') return true;
  if (code !== 'P2010') return false;
  const meta = (error as { meta?: unknown }).meta;
  return typeof meta === 'object' && meta !== null && 'code' in meta && meta.code === '40001';
}
