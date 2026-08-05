import { PrismaClient } from '@prisma/client';

import { seedDatabase } from '../../prisma/seed-data';
import {
  clearDatabase,
  createEstablishment,
  createMembership,
  createMenu,
  createOrganization,
  createSession,
  createTenantFixture,
  createUser,
} from '../../src/testing';

const database = new PrismaClient();

describe('tenant domain schema', () => {
  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('connects users to multiple organizations without a direct establishment relation', async () => {
    const firstTenant = await createTenantFixture(database, { label: 'First' });
    const secondTenant = await createTenantFixture(database, {
      label: 'Second',
      userId: firstTenant.user.id,
    });
    const session = await createSession(database, { userId: firstTenant.user.id });

    const user = await database.user.findUniqueOrThrow({
      where: { id: firstTenant.user.id },
      include: {
        memberships: {
          include: {
            organization: {
              include: { establishments: { include: { menus: true } } },
            },
          },
        },
        sessions: true,
      },
    });

    expect(user.memberships).toHaveLength(2);
    expect(user.memberships.map(({ organizationId }) => organizationId).sort()).toEqual(
      [firstTenant.organization.id, secondTenant.organization.id].sort(),
    );
    expect(
      user.memberships.every(({ organization }) => organization.establishments.length === 1),
    ).toBe(true);
    expect(
      user.memberships.every(
        ({ organization }) => organization.establishments[0]?.menus.length === 1,
      ),
    ).toBe(true);
    expect(user.sessions).toEqual([expect.objectContaining({ id: session.id, userId: user.id })]);
  });

  it('enforces relevant uniqueness rules', async () => {
    const tenant = await createTenantFixture(database, { label: 'Unique' });
    const session = await createSession(database, { userId: tenant.user.id });

    await expect(createUser(database, { email: tenant.user.email })).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(
      createSession(database, { userId: tenant.user.id, tokenHash: session.tokenHash }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      createMembership(database, {
        organizationId: tenant.organization.id,
        userId: tenant.user.id,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const otherOrganization = await createOrganization(database);
    await expect(
      createEstablishment(database, {
        organizationId: otherOrganization.id,
        publicId: tenant.establishment.publicId,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      createEstablishment(database, {
        organizationId: tenant.organization.id,
        slug: tenant.establishment.slug,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      createMenu(database, {
        organizationId: tenant.organization.id,
        establishmentId: tenant.establishment.id,
        name: tenant.menu.name,
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces normalization, format and temporal checks in PostgreSQL', async () => {
    const user = await createUser(database);
    const organization = await createOrganization(database);

    await expect(createUser(database, { email: 'UPPERCASE@example.test' })).rejects.toBeDefined();
    await expect(createOrganization(database, { name: '   ' })).rejects.toBeDefined();
    await expect(
      createEstablishment(database, { organizationId: organization.id, slug: 'Invalid Slug' }),
    ).rejects.toBeDefined();
    await expect(
      createSession(database, { userId: user.id, expiresAt: new Date(0) }),
    ).rejects.toBeDefined();
  });

  it('isolates tenant queries and rejects cross-organization menu relations', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Tenant A' });
    const tenantB = await createTenantFixture(database, { label: 'Tenant B' });

    const tenantAMenus = await database.menu.findMany({
      where: { organizationId: tenantA.organization.id },
      include: { establishment: true },
    });
    const tenantBMenus = await database.menu.findMany({
      where: { organizationId: tenantB.organization.id },
      include: { establishment: true },
    });

    expect(tenantAMenus).toEqual([
      expect.objectContaining({
        id: tenantA.menu.id,
        organizationId: tenantA.organization.id,
        establishment: expect.objectContaining({ organizationId: tenantA.organization.id }),
      }),
    ]);
    expect(tenantBMenus).toEqual([
      expect.objectContaining({ id: tenantB.menu.id, organizationId: tenantB.organization.id }),
    ]);
    await expect(
      createMenu(database, {
        organizationId: tenantA.organization.id,
        establishmentId: tenantB.establishment.id,
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('keeps public IDs immutable and restricts aggregate deletion', async () => {
    const tenant = await createTenantFixture(database);

    await expect(
      database.establishment.update({
        where: { id: tenant.establishment.id },
        data: { publicId: 'replacement-public-id' },
      }),
    ).rejects.toBeDefined();
    await expect(
      database.organization.delete({ where: { id: tenant.organization.id } }),
    ).rejects.toBeDefined();
    await expect(
      database.establishment.delete({ where: { id: tenant.establishment.id } }),
    ).rejects.toBeDefined();
  });

  it('cascades technical and junction records when a user is deleted', async () => {
    const tenant = await createTenantFixture(database);
    await createSession(database, { userId: tenant.user.id });

    await database.user.delete({ where: { id: tenant.user.id } });

    await expect(database.user.findUnique({ where: { id: tenant.user.id } })).resolves.toBeNull();
    await expect(database.session.count({ where: { userId: tenant.user.id } })).resolves.toBe(0);
    await expect(database.membership.count({ where: { userId: tenant.user.id } })).resolves.toBe(0);
    await expect(
      database.organization.findUnique({ where: { id: tenant.organization.id } }),
    ).resolves.not.toBeNull();
  });

  it('can run the seed repeatedly without duplicating records', async () => {
    await seedDatabase(database);
    await seedDatabase(database);

    await expect(
      Promise.all([
        database.user.count(),
        database.organization.count(),
        database.membership.count(),
        database.establishment.count(),
        database.menu.count(),
        database.session.count(),
      ]),
    ).resolves.toEqual([2, 2, 2, 2, 2, 0]);

    const organizations = await database.organization.findMany({
      include: { memberships: true, establishments: { include: { menus: true } } },
    });
    expect(organizations).toHaveLength(2);
    expect(organizations.every(({ memberships }) => memberships.length === 1)).toBe(true);
    expect(organizations.every(({ establishments }) => establishments[0]?.menus.length === 1)).toBe(
      true,
    );
  });
});
