import { HttpStatus, Injectable } from '@nestjs/common';
import { hasPermission, type MembershipRole, type Permission } from '@pratto/contracts';
import { prisma } from '@pratto/database';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

export interface AuthorizedMembership {
  membershipId: string;
  role: MembershipRole;
}

@Injectable()
export class EstablishmentAuthorizationService {
  async requirePermission(
    tenant: TenantPrincipal,
    permission: Permission,
  ): Promise<AuthorizedMembership> {
    const membership = await prisma.membership.findFirst({
      where: {
        id: tenant.membershipId,
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        organization: { status: 'ACTIVE' },
      },
      select: { id: true, role: true },
    });

    if (!membership) {
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'ESTABLISHMENT_ACCESS_DENIED',
        'O acesso ao estabelecimento não está ativo.',
      );
    }
    if (!hasPermission(membership.role, permission)) {
      throw new StableHttpException(
        HttpStatus.FORBIDDEN,
        'PERMISSION_DENIED',
        'Seu perfil não possui permissão para esta operação.',
        { permission },
      );
    }

    return { membershipId: membership.id, role: membership.role };
  }

  async requireEstablishmentPermission(
    tenant: TenantPrincipal,
    establishmentId: string,
    permission: Permission,
  ): Promise<AuthorizedMembership> {
    const establishment = await prisma.establishment.findFirst({
      where: {
        id: establishmentId,
        organizationId: tenant.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!establishment) this.establishmentNotFound();

    return this.requirePermission(tenant, permission);
  }

  async requireMenuPermission(
    tenant: TenantPrincipal,
    menuId: string,
    permission: Permission,
  ): Promise<AuthorizedMembership> {
    const menu = await prisma.menu.findFirst({
      where: {
        id: menuId,
        organizationId: tenant.organizationId,
        establishment: {
          organizationId: tenant.organizationId,
          status: 'ACTIVE',
        },
      },
      select: { id: true },
    });
    if (!menu) this.menuNotFound();

    return this.requirePermission(tenant, permission);
  }

  private establishmentNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'ESTABLISHMENT_NOT_FOUND',
      'Estabelecimento não encontrado.',
    );
  }

  private menuNotFound(): never {
    throw new StableHttpException(HttpStatus.NOT_FOUND, 'MENU_NOT_FOUND', 'Menu não encontrado.');
  }
}
