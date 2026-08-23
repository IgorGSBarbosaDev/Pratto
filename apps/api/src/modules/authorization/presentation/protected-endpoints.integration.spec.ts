import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { prisma } from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { CatalogService } from '../../catalog/application/catalog.service';
import { CatalogController } from '../../catalog/presentation/catalog.controller';
import { EstablishmentService } from '../../establishments/application/establishment.service';
import { EstablishmentController } from '../../establishments/presentation/establishment.controller';
import { AuthService } from '../../identity/application/auth.service';
import type { TenantPrincipal } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { TeamService } from '../../team/application/team.service';
import { TeamController } from '../../team/presentation/team.controller';
import { EstablishmentAuthorizationService } from '../application/establishment-authorization.service';

import { PermissionGuard } from './permission.guard';

jest.mock('@pratto/config', () => ({
  loadEnvironment: () => ({ COOKIE_SECRET: 'test-secret', WEB_URL: 'http://localhost:3000' }),
}));

jest.mock('@pratto/database', () => ({
  Prisma: {},
  prisma: {
    establishment: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn() },
    menu: { findFirst: jest.fn() },
  },
}));

const database = prisma as unknown as {
  establishment: { findFirst: jest.Mock };
  membership: { findFirst: jest.Mock };
  menu: { findFirst: jest.Mock };
};

const establishmentA = '11111111-1111-4111-8111-111111111111';
const establishmentB = '22222222-2222-4222-8222-222222222222';
const menuA = '33333333-3333-4333-8333-333333333333';
const menuB = '44444444-4444-4444-8444-444444444444';
const organizationA = '55555555-5555-4555-8555-555555555555';
const organizationB = '66666666-6666-4666-8666-666666666666';

function tenant(
  token: string,
  role: TenantPrincipal['role'],
  membershipId = `${token}-membership`,
) {
  return {
    sessionId: `${token}-session`,
    userId: `${token}-user`,
    rawToken: token,
    expiresAt: new Date(Date.now() + 60_000),
    renewed: false,
    membershipId,
    organizationId: organizationA,
    role,
    establishmentIds: [establishmentA],
  } satisfies TenantPrincipal;
}

describe('protected establishment endpoints', () => {
  let app: INestApplication;
  let baseUrl: string;
  const contexts = new Map<string, TenantPrincipal>([
    ['owner', tenant('owner', 'OWNER')],
    ['admin', tenant('admin', 'ADMIN')],
    ['member', tenant('member', 'MEMBER')],
    ['removed', tenant('removed', 'OWNER', 'removed-membership')],
  ]);
  const listMenusForEstablishment = jest.fn();
  const createCategory = jest.fn();
  const getTeam = jest.fn();
  const updateSettings = jest.fn();

  beforeAll(async () => {
    const authService = {
      authenticate: jest.fn(async (token: string | undefined) => {
        const context = token ? contexts.get(token) : undefined;
        if (!context) {
          throw new StableHttpException(
            HttpStatus.UNAUTHORIZED,
            'AUTHENTICATION_REQUIRED',
            'Autenticação obrigatória.',
          );
        }
        return context;
      }),
      resolveTenantPrincipal: jest.fn(async (principal: TenantPrincipal) => principal),
    };
    const module = await Test.createTestingModule({
      controllers: [CatalogController, EstablishmentController, TeamController],
      providers: [
        AuthenticatedGuard,
        OrganizationGuard,
        PermissionGuard,
        EstablishmentAuthorizationService,
        CsrfGuard,
        { provide: AuthService, useValue: authService },
        {
          provide: CatalogService,
          useValue: {
            listMenusForEstablishment,
            createCategory,
          },
        },
        { provide: EstablishmentService, useValue: { updateSettings } },
        { provide: TeamService, useValue: { getTeam } },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    database.establishment.findFirst.mockImplementation(({ where }) =>
      where.id === establishmentA && where.organizationId === organizationA
        ? Promise.resolve({ id: establishmentA })
        : Promise.resolve(null),
    );
    database.menu.findFirst.mockImplementation(({ where }) =>
      where.id === menuA && where.organizationId === organizationA
        ? Promise.resolve({ id: menuA })
        : Promise.resolve(null),
    );
    database.membership.findFirst.mockImplementation(({ where }) => {
      const context = [...contexts.values()].find(
        (item) => item.membershipId === where.id && item.userId === where.userId,
      );
      return context && context.rawToken !== 'removed'
        ? Promise.resolve({ id: context.membershipId, role: context.role })
        : Promise.resolve(null);
    });
    listMenusForEstablishment.mockResolvedValue({ establishmentId: establishmentA, menus: [] });
  });

  afterAll(async () => {
    await app.close();
  });

  async function request(path: string, token?: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(token ? { cookie: `pratto_session=${token}` } : {}),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  }

  it('returns 401 without a valid authenticated session', async () => {
    const response = await request(`/admin/establishments/${establishmentA}/menus`);

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('allows an active member to access their own establishment', async () => {
    const response = await request(`/admin/establishments/${establishmentA}/menus`, 'member');

    expect(response.status).toBe(HttpStatus.OK);
    expect(listMenusForEstablishment).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: 'member-membership', role: 'MEMBER' }),
      establishmentA,
    );
  });

  it('rejects a session whose establishment membership was removed', async () => {
    const response = await request(`/admin/establishments/${establishmentA}/menus`, 'removed');

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    await expect(response.json()).resolves.toMatchObject({ code: 'ESTABLISHMENT_ACCESS_DENIED' });
    expect(listMenusForEstablishment).not.toHaveBeenCalled();
  });

  it('blocks MEMBER administration and ADMIN owner-only operations at the endpoint', async () => {
    const memberResponse = await request(`/admin/establishments/${establishmentA}/team`, 'member');
    const adminResponse = await request(
      `/admin/establishments/${establishmentA}/settings`,
      'admin',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Tentativa direta' }),
      },
    );

    expect(memberResponse.status).toBe(HttpStatus.FORBIDDEN);
    expect(adminResponse.status).toBe(HttpStatus.FORBIDDEN);
    await expect(memberResponse.json()).resolves.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(adminResponse.json()).resolves.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(getTeam).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('hides cross-establishment targets even when route IDs are changed directly', async () => {
    const response = await request(`/admin/establishments/${establishmentB}/menus`, 'owner');

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    await expect(response.json()).resolves.toMatchObject({ code: 'ESTABLISHMENT_NOT_FOUND' });
    expect(listMenusForEstablishment).not.toHaveBeenCalled();
  });

  it('blocks direct mutation calls and cross-tenant resource IDs before the handler', async () => {
    const memberResponse = await request(`/admin/menus/${menuA}/categories`, 'member', {
      method: 'POST',
      body: JSON.stringify({ name: 'Sem permissão' }),
    });
    const crossTenantResponse = await request(`/admin/menus/${menuB}/categories`, 'admin', {
      method: 'POST',
      body: JSON.stringify({ name: 'Outro tenant' }),
    });

    expect(memberResponse.status).toBe(HttpStatus.FORBIDDEN);
    expect(crossTenantResponse.status).toBe(HttpStatus.NOT_FOUND);
    await expect(memberResponse.json()).resolves.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(crossTenantResponse.json()).resolves.toMatchObject({ code: 'MENU_NOT_FOUND' });
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('scopes all authorization lookups to the selected organization', async () => {
    await request(`/admin/establishments/${establishmentB}/menus`, 'owner');
    await request(`/admin/menus/${menuB}/categories`, 'owner', {
      method: 'POST',
      body: JSON.stringify({ name: 'Outro tenant' }),
    });

    expect(database.establishment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: organizationA }),
      }),
    );
    expect(database.menu.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: organizationA,
          establishment: expect.objectContaining({ organizationId: organizationA }),
        }),
      }),
    );
    expect(organizationB).not.toBe(organizationA);
  });
});
