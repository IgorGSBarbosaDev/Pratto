import { LifecycleStatus, MembershipRole, MenuStatus, type PrismaClient } from '@prisma/client';

export const seedIds = {
  users: {
    prattoOwner: '10000000-0000-4000-8000-000000000001',
    cafeOwner: '10000000-0000-4000-8000-000000000002',
  },
  organizations: {
    pratto: '20000000-0000-4000-8000-000000000001',
    cafe: '20000000-0000-4000-8000-000000000002',
  },
  memberships: {
    prattoOwner: '30000000-0000-4000-8000-000000000001',
    cafeOwner: '30000000-0000-4000-8000-000000000002',
  },
  establishments: {
    pratto: '40000000-0000-4000-8000-000000000001',
    cafe: '40000000-0000-4000-8000-000000000002',
  },
  menus: {
    pratto: '50000000-0000-4000-8000-000000000001',
    cafe: '50000000-0000-4000-8000-000000000002',
  },
} as const;

export async function seedDatabase(database: PrismaClient): Promise<void> {
  await database.$transaction(async (transaction) => {
    const prattoOwner = await transaction.user.upsert({
      where: { email: 'owner@pratto.local' },
      update: { name: 'Pratto Owner', status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.users.prattoOwner,
        email: 'owner@pratto.local',
        name: 'Pratto Owner',
        status: LifecycleStatus.ACTIVE,
      },
    });

    const cafeOwner = await transaction.user.upsert({
      where: { email: 'owner@cafe-aurora.local' },
      update: { name: 'Café Aurora Owner', status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.users.cafeOwner,
        email: 'owner@cafe-aurora.local',
        name: 'Café Aurora Owner',
        status: LifecycleStatus.ACTIVE,
      },
    });

    const prattoOrganization = await transaction.organization.upsert({
      where: { id: seedIds.organizations.pratto },
      update: { name: 'Pratto Burger', status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.organizations.pratto,
        name: 'Pratto Burger',
        status: LifecycleStatus.ACTIVE,
      },
    });

    const cafeOrganization = await transaction.organization.upsert({
      where: { id: seedIds.organizations.cafe },
      update: { name: 'Café Aurora', status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.organizations.cafe,
        name: 'Café Aurora',
        status: LifecycleStatus.ACTIVE,
      },
    });

    await transaction.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: prattoOrganization.id,
          userId: prattoOwner.id,
        },
      },
      update: { role: MembershipRole.OWNER, status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.memberships.prattoOwner,
        organizationId: prattoOrganization.id,
        userId: prattoOwner.id,
        role: MembershipRole.OWNER,
        status: LifecycleStatus.ACTIVE,
      },
    });

    await transaction.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: cafeOrganization.id,
          userId: cafeOwner.id,
        },
      },
      update: { role: MembershipRole.OWNER, status: LifecycleStatus.ACTIVE },
      create: {
        id: seedIds.memberships.cafeOwner,
        organizationId: cafeOrganization.id,
        userId: cafeOwner.id,
        role: MembershipRole.OWNER,
        status: LifecycleStatus.ACTIVE,
      },
    });

    const prattoEstablishment = await transaction.establishment.upsert({
      where: { id: seedIds.establishments.pratto },
      update: {
        organizationId: prattoOrganization.id,
        name: 'Pratto Burger',
        slug: 'pratto-burger',
        status: LifecycleStatus.ACTIVE,
      },
      create: {
        id: seedIds.establishments.pratto,
        organizationId: prattoOrganization.id,
        publicId: 'pratto-burger-local',
        name: 'Pratto Burger',
        slug: 'pratto-burger',
        status: LifecycleStatus.ACTIVE,
      },
    });

    const cafeEstablishment = await transaction.establishment.upsert({
      where: { id: seedIds.establishments.cafe },
      update: {
        organizationId: cafeOrganization.id,
        name: 'Café Aurora',
        slug: 'cafe-aurora',
        status: LifecycleStatus.ACTIVE,
      },
      create: {
        id: seedIds.establishments.cafe,
        organizationId: cafeOrganization.id,
        publicId: 'cafe-aurora-local',
        name: 'Café Aurora',
        slug: 'cafe-aurora',
        status: LifecycleStatus.ACTIVE,
      },
    });

    await transaction.menu.upsert({
      where: { id: seedIds.menus.pratto },
      update: {
        organizationId: prattoOrganization.id,
        establishmentId: prattoEstablishment.id,
        name: 'Menu principal',
        status: MenuStatus.DRAFT,
      },
      create: {
        id: seedIds.menus.pratto,
        organizationId: prattoOrganization.id,
        establishmentId: prattoEstablishment.id,
        name: 'Menu principal',
        status: MenuStatus.DRAFT,
      },
    });

    await transaction.menu.upsert({
      where: { id: seedIds.menus.cafe },
      update: {
        organizationId: cafeOrganization.id,
        establishmentId: cafeEstablishment.id,
        name: 'Menu principal',
        status: MenuStatus.DRAFT,
      },
      create: {
        id: seedIds.menus.cafe,
        organizationId: cafeOrganization.id,
        establishmentId: cafeEstablishment.id,
        name: 'Menu principal',
        status: MenuStatus.DRAFT,
      },
    });
  });
}
