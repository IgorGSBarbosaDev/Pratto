import { randomUUID } from 'node:crypto';

import {
  LifecycleStatus,
  MembershipRole,
  MenuStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

type SessionFactoryInput = Pick<Prisma.SessionUncheckedCreateInput, 'userId'> &
  Partial<Prisma.SessionUncheckedCreateInput>;
type MembershipFactoryInput = Pick<
  Prisma.MembershipUncheckedCreateInput,
  'organizationId' | 'userId'
> &
  Partial<Prisma.MembershipUncheckedCreateInput>;
type EstablishmentFactoryInput = Pick<Prisma.EstablishmentUncheckedCreateInput, 'organizationId'> &
  Partial<Prisma.EstablishmentUncheckedCreateInput>;
type MenuFactoryInput = Pick<
  Prisma.MenuUncheckedCreateInput,
  'organizationId' | 'establishmentId'
> &
  Partial<Prisma.MenuUncheckedCreateInput>;
type MenuPublicationFactoryInput = Pick<
  Prisma.MenuPublicationUncheckedCreateInput,
  'organizationId' | 'menuId' | 'publishedBy'
> &
  Partial<Prisma.MenuPublicationUncheckedCreateInput>;

function uniqueValue(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

export function createUser(
  database: DatabaseClient,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const unique = uniqueValue();

  return database.user.create({
    data: {
      email: `user-${unique}@example.test`,
      name: `User ${unique}`,
      status: LifecycleStatus.ACTIVE,
      ...overrides,
    },
  });
}

export function createSession(database: DatabaseClient, input: SessionFactoryInput) {
  const unique = uniqueValue();
  const absoluteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return database.session.create({
    data: {
      tokenHash: `token-hash-${unique}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      absoluteExpiresAt,
      ...input,
    },
  });
}

export function createOrganization(
  database: DatabaseClient,
  overrides: Partial<Prisma.OrganizationUncheckedCreateInput> = {},
) {
  const unique = uniqueValue();

  return database.organization.create({
    data: {
      name: `Organization ${unique}`,
      status: LifecycleStatus.ACTIVE,
      ...overrides,
    },
  });
}

export function createMembership(database: DatabaseClient, input: MembershipFactoryInput) {
  return database.membership.create({
    data: {
      role: MembershipRole.OWNER,
      status: LifecycleStatus.ACTIVE,
      ...input,
    },
  });
}

export function createEstablishment(database: DatabaseClient, input: EstablishmentFactoryInput) {
  const unique = uniqueValue();

  return database.establishment.create({
    data: {
      publicId: `test-${unique}`,
      name: `Establishment ${unique}`,
      slug: `establishment-${unique}`,
      status: LifecycleStatus.ACTIVE,
      ...input,
    },
  });
}

export function createMenu(database: DatabaseClient, input: MenuFactoryInput) {
  const unique = uniqueValue();

  return database.menu.create({
    data: {
      name: `Menu ${unique}`,
      status: MenuStatus.DRAFT,
      ...input,
    },
  });
}

export function createMenuPublication(
  database: DatabaseClient,
  input: MenuPublicationFactoryInput,
) {
  const unique = uniqueValue();

  return database.menuPublication.create({
    data: {
      version: 1,
      snapshot: {},
      idempotencyKey: `publication-${unique}`,
      ...input,
    },
  });
}

export async function createTenantFixture(
  database: PrismaClient,
  options: { label?: string; userId?: string } = {},
) {
  return database.$transaction(async (transaction) => {
    const unique = uniqueValue();
    const label = options.label ?? unique;
    const user = options.userId
      ? await transaction.user.findUniqueOrThrow({ where: { id: options.userId } })
      : await createUser(transaction, {
          email: `owner-${unique}@example.test`,
          name: `${label} Owner`,
        });
    const organization = await createOrganization(transaction, { name: `${label} Organization` });
    const membership = await createMembership(transaction, {
      organizationId: organization.id,
      userId: user.id,
    });
    const establishment = await createEstablishment(transaction, {
      organizationId: organization.id,
      name: `${label} Establishment`,
    });
    const menu = await createMenu(transaction, {
      organizationId: organization.id,
      establishmentId: establishment.id,
      name: `${label} Menu`,
    });

    return { user, organization, membership, establishment, menu };
  });
}

export async function clearDatabase(database: PrismaClient): Promise<void> {
  await database.$executeRaw`
    TRUNCATE TABLE
      "menu_publications",
      "products",
      "categories",
      "menus",
      "establishments",
      "memberships",
      "organizations",
      "authentication_events",
      "auth_rate_limit_buckets",
      "password_reset_tokens",
      "password_credentials",
      "sessions",
      "users"
    CASCADE
  `;
}
