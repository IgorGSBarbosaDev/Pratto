import { type Prisma, PrismaClient, MenuStatus, MembershipRole } from '@prisma/client';

import { CatalogMenuSnapshotSource } from '../../../../apps/api/src/modules/catalog/application/catalog-menu-snapshot-source';
import {
  MenuPublicationService as PublicationService,
  type MenuSnapshotSource,
} from '../../src/menu-publication';
import {
  clearDatabase,
  createMenu,
  createMenuPublication,
  createTenantFixture,
} from '../../src/testing';

const database = new PrismaClient();

class MenuSnapshotFixture implements MenuSnapshotSource {
  public calls = 0;
  public fail = false;

  async buildSnapshot(input: {
    transaction: Prisma.TransactionClient;
    menuId: string;
    organizationId: string;
  }) {
    this.calls += 1;
    if (this.fail) throw new Error('snapshot source failed');

    const menu = await input.transaction.menu.findFirstOrThrow({
      where: { id: input.menuId, organizationId: input.organizationId },
      select: { id: true, name: true },
    });

    return {
      menu: { id: menu.id, name: menu.name },
      categories: [],
      products: [],
      media: [],
    };
  }
}

function createService(source = new MenuSnapshotFixture()): PublicationService {
  return new PublicationService(database, source);
}

describe('versioned menu publications', () => {
  beforeEach(async () => {
    await clearDatabase(database);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('creates a snapshot, activates it and keeps the previous version unchanged', async () => {
    const tenant = await createTenantFixture(database, { label: 'Publication' });
    const source = new MenuSnapshotFixture();
    const service = createService(source);

    const first = await service.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'publication-1',
    });

    await database.menu.update({
      where: { id: tenant.menu.id },
      data: { name: 'Edited menu' },
    });
    const second = await service.publish({
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'publication-2',
    });

    const menu = await database.menu.findUniqueOrThrow({ where: { id: tenant.menu.id } });
    const previous = await database.menuPublication.findUniqueOrThrow({ where: { id: first.id } });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(menu.status).toBe(MenuStatus.ACTIVE);
    expect(menu.activePublicationId).toBe(second.id);
    expect(previous.snapshot).toMatchObject({
      menu: { name: tenant.menu.name },
    });
    expect(second.snapshot).toMatchObject({ menu: { name: 'Edited menu' } });
    expect(source.calls).toBe(2);
  });

  it('is idempotent and does not consume another version on retry', async () => {
    const tenant = await createTenantFixture(database, { label: 'Idempotency' });
    const source = new MenuSnapshotFixture();
    const service = createService(source);
    const input = {
      menuId: tenant.menu.id,
      tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
      idempotencyKey: 'same-request',
    };

    const first = await service.publish(input);
    const retry = await service.publish(input);

    expect(retry.id).toBe(first.id);
    expect(retry.version).toBe(1);
    expect(source.calls).toBe(1);
    await expect(
      database.menuPublication.count({ where: { menuId: tenant.menu.id } }),
    ).resolves.toBe(1);
  });

  it('returns the active publication and bounded version history within the tenant', async () => {
    const tenant = await createTenantFixture(database, { label: 'Publication queries' });
    const service = createService();
    const context = {
      organizationId: tenant.organization.id,
      userId: tenant.user.id,
      establishmentIds: [tenant.establishment.id],
    };

    const first = await service.publish({
      menuId: tenant.menu.id,
      tenant: context,
      idempotencyKey: 'query-1',
    });
    const second = await service.publish({
      menuId: tenant.menu.id,
      tenant: context,
      idempotencyKey: 'query-2',
    });

    await expect(
      service.getActive({ menuId: tenant.menu.id, tenant: context }),
    ).resolves.toMatchObject({
      id: second.id,
      version: 2,
    });
    await expect(service.listHistory({ menuId: tenant.menu.id, tenant: context })).resolves.toEqual(
      [
        expect.objectContaining({ id: second.id, version: 2 }),
        expect.objectContaining({ id: first.id, version: 1 }),
      ],
    );
  });

  it('freezes establishment assets and settings in each complete snapshot', async () => {
    const tenant = await createTenantFixture(database, { label: 'Complete snapshot' });
    await database.establishment.update({
      where: { id: tenant.establishment.id },
      data: {
        description: 'Descrição original',
        logoKey: 'establishments/original-logo.png',
        logoContentType: 'image/png',
      },
    });
    const service = new PublicationService(database, new CatalogMenuSnapshotSource());
    const context = { organizationId: tenant.organization.id, userId: tenant.user.id };

    const first = await service.publish({
      menuId: tenant.menu.id,
      tenant: context,
      idempotencyKey: 'complete-snapshot-1',
    });

    await database.establishment.update({
      where: { id: tenant.establishment.id },
      data: {
        description: 'Descrição atualizada',
        logoKey: 'establishments/updated-logo.webp',
        logoContentType: 'image/webp',
      },
    });
    const second = await service.publish({
      menuId: tenant.menu.id,
      tenant: context,
      idempotencyKey: 'complete-snapshot-2',
    });

    expect(first.snapshot).toMatchObject({
      schemaVersion: 3,
      establishment: {
        id: tenant.establishment.id,
        description: 'Descrição original',
        logo: { storageKey: 'establishments/original-logo.png', contentType: 'image/png' },
      },
      menu: { id: tenant.menu.id },
      categories: [],
      products: [],
      media: [],
    });
    expect(second.snapshot).toMatchObject({
      establishment: {
        description: 'Descrição atualizada',
        logo: { storageKey: 'establishments/updated-logo.webp', contentType: 'image/webp' },
      },
    });
    expect(first.snapshot).toMatchObject({
      establishment: {
        description: 'Descrição original',
        logo: { storageKey: 'establishments/original-logo.png' },
      },
    });
  });

  it('serializes concurrent publications for the same menu', async () => {
    const tenant = await createTenantFixture(database, { label: 'Concurrency' });
    const service = createService();
    const tenantContext = {
      organizationId: tenant.organization.id,
      userId: tenant.user.id,
    };

    const publications = await Promise.all([
      service.publish({
        menuId: tenant.menu.id,
        tenant: tenantContext,
        idempotencyKey: 'parallel-1',
      }),
      service.publish({
        menuId: tenant.menu.id,
        tenant: tenantContext,
        idempotencyKey: 'parallel-2',
      }),
    ]);
    const versions = publications.map(({ version }) => version).sort((a, b) => a - b);
    const menu = await database.menu.findUniqueOrThrow({ where: { id: tenant.menu.id } });

    expect(versions).toEqual([1, 2]);
    expect(menu.activePublicationId).toBe(publications.find(({ version }) => version === 2)?.id);
  });

  it('rejects access from another tenant and non-administrative memberships', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Tenant A' });
    const tenantB = await createTenantFixture(database, { label: 'Tenant B' });
    const member = await createTenantFixture(database, {
      label: 'Member tenant',
    });
    await database.membership.update({
      where: { id: member.membership.id },
      data: { role: MembershipRole.MEMBER },
    });
    const service = createService();

    await expect(
      service.publish({
        menuId: tenantB.menu.id,
        tenant: { organizationId: tenantA.organization.id, userId: tenantA.user.id },
        idempotencyKey: 'cross-menu',
      }),
    ).rejects.toMatchObject({ code: 'MENU_NOT_FOUND' });
    await expect(
      service.publish({
        menuId: tenantA.menu.id,
        tenant: { organizationId: tenantA.organization.id, userId: tenantB.user.id },
        idempotencyKey: 'cross-user',
      }),
    ).rejects.toMatchObject({ code: 'PUBLICATION_ACCESS_DENIED' });
    await expect(
      service.getActive({
        menuId: tenantB.menu.id,
        tenant: { organizationId: tenantA.organization.id, userId: tenantA.user.id },
      }),
    ).rejects.toMatchObject({ code: 'MENU_NOT_FOUND' });
    await expect(
      service.publish({
        menuId: member.menu.id,
        tenant: { organizationId: member.organization.id, userId: member.user.id },
        idempotencyKey: 'member-publish',
      }),
    ).rejects.toMatchObject({ code: 'PUBLICATION_ACCESS_DENIED' });
  });

  it('rejects archived menus before creating a publication', async () => {
    const tenant = await createTenantFixture(database, { label: 'Archived' });
    await database.menu.update({
      where: { id: tenant.menu.id },
      data: { status: MenuStatus.ARCHIVED },
    });

    await expect(
      createService().publish({
        menuId: tenant.menu.id,
        tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
        idempotencyKey: 'archived-menu',
      }),
    ).rejects.toMatchObject({ code: 'MENU_ARCHIVED' });
    await expect(database.menuPublication.count()).resolves.toBe(0);
  });

  it('rolls back publication and activation when snapshot creation fails', async () => {
    const tenant = await createTenantFixture(database, { label: 'Rollback' });
    const source = new MenuSnapshotFixture();
    source.fail = true;

    await expect(
      createService(source).publish({
        menuId: tenant.menu.id,
        tenant: { organizationId: tenant.organization.id, userId: tenant.user.id },
        idempotencyKey: 'failed-snapshot',
      }),
    ).rejects.toThrow('snapshot source failed');

    const menu = await database.menu.findUniqueOrThrow({ where: { id: tenant.menu.id } });
    expect(menu.activePublicationId).toBeNull();
    await expect(database.menuPublication.count()).resolves.toBe(0);
  });

  it('enforces publication constraints and database immutability', async () => {
    const tenant = await createTenantFixture(database, { label: 'Constraints' });
    const publication = await createMenuPublication(database, {
      organizationId: tenant.organization.id,
      menuId: tenant.menu.id,
      publishedBy: tenant.user.id,
    });

    await expect(
      createMenuPublication(database, {
        organizationId: tenant.organization.id,
        menuId: tenant.menu.id,
        publishedBy: tenant.user.id,
        version: publication.version,
        idempotencyKey: 'different-key',
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      database.menuPublication.create({
        data: {
          organizationId: tenant.organization.id,
          menuId: tenant.menu.id,
          publishedBy: tenant.user.id,
          version: 2,
          snapshot: [],
          idempotencyKey: 'invalid-snapshot',
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.menuPublication.update({
        where: { id: publication.id },
        data: { snapshot: { changed: true } },
      }),
    ).rejects.toThrow();
    await expect(
      database.menuPublication.delete({ where: { id: publication.id } }),
    ).rejects.toThrow();
  });

  it('rejects cross-tenant and cross-menu publication references', async () => {
    const tenantA = await createTenantFixture(database, { label: 'Relation A' });
    const tenantB = await createTenantFixture(database, { label: 'Relation B' });
    const otherMenu = await createMenu(database, {
      organizationId: tenantA.organization.id,
      establishmentId: tenantA.establishment.id,
      name: 'Other menu',
    });
    const publicationB = await createMenuPublication(database, {
      organizationId: tenantB.organization.id,
      menuId: tenantB.menu.id,
      publishedBy: tenantB.user.id,
    });
    const publicationA = await createMenuPublication(database, {
      organizationId: tenantA.organization.id,
      menuId: tenantA.menu.id,
      publishedBy: tenantA.user.id,
    });

    await expect(
      createMenuPublication(database, {
        organizationId: tenantA.organization.id,
        menuId: tenantB.menu.id,
        publishedBy: tenantA.user.id,
        version: 2,
        idempotencyKey: 'cross-tenant-publication',
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      database.menu.update({
        where: { id: otherMenu.id },
        data: { activePublicationId: publicationA.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.menu.update({
        where: { id: tenantA.menu.id },
        data: { activePublicationId: publicationB.id },
      }),
    ).rejects.toThrow();
  });
});
