import { LifecycleStatus, MenuStatus, MembershipRole } from '@prisma/client';
import type { MenuPublication, Prisma, PrismaClient } from '@prisma/client';

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
}

export interface PublishMenuInput {
  menuId: string;
  tenant: PublicationTenantContext;
  idempotencyKey: string;
}

export type MenuPublicationErrorCode =
  'IDEMPOTENCY_KEY_INVALID' | 'PUBLICATION_ACCESS_DENIED' | 'MENU_NOT_FOUND' | 'MENU_ARCHIVED';

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

  publish(input: PublishMenuInput): Promise<MenuPublication> {
    const idempotencyKey = input.idempotencyKey.trim();
    if (idempotencyKey.length === 0 || idempotencyKey.length > 128) {
      throw new MenuPublicationServiceError(
        'IDEMPOTENCY_KEY_INVALID',
        'A chave de idempotência deve ter entre 1 e 128 caracteres.',
      );
    }

    return this.database.$transaction(async (transaction) => {
      const membership = await transaction.membership.findFirst({
        where: {
          organizationId: input.tenant.organizationId,
          userId: input.tenant.userId,
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

      const lockedMenus = await transaction.$queryRaw<Array<{ id: string; status: MenuStatus }>>`
        SELECT "id", "status"
        FROM "menus"
        WHERE "id" = ${input.menuId}::uuid
          AND "organization_id" = ${input.tenant.organizationId}::uuid
        FOR UPDATE
      `;
      const menu = lockedMenus[0];
      if (!menu) {
        throw new MenuPublicationServiceError(
          'MENU_NOT_FOUND',
          'O menu não foi encontrado neste tenant.',
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

      if (menu.status === MenuStatus.ARCHIVED) {
        throw new MenuPublicationServiceError(
          'MENU_ARCHIVED',
          'Menus arquivados não podem receber novas publicações.',
        );
      }

      const snapshot = await this.snapshotSource.buildSnapshot({
        transaction,
        menuId: input.menuId,
        organizationId: input.tenant.organizationId,
      });
      const latestPublication = await transaction.menuPublication.aggregate({
        where: { menuId: input.menuId },
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
    });
  }
}
