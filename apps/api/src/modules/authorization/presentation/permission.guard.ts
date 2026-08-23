import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@pratto/contracts';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { EstablishmentAuthorizationService } from '../application/establishment-authorization.service';

import { REQUIRED_PERMISSIONS } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EstablishmentAuthorizationService)
    private readonly authorization: EstablishmentAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new StableHttpException(
        HttpStatus.UNAUTHORIZED,
        'AUTHENTICATION_REQUIRED',
        'Autenticação obrigatória.',
      );
    }
    const establishmentId = this.validUuid(request.params?.establishmentId);
    const menuId = this.validUuid(request.params?.menuId);
    const membership = establishmentId
      ? await this.authorization.requireEstablishmentPermission(tenant, establishmentId, permission)
      : menuId
        ? await this.authorization.requireMenuPermission(tenant, menuId, permission)
        : await this.authorization.requirePermission(tenant, permission);

    request.tenant = { ...tenant, membershipId: membership.membershipId, role: membership.role };
    return true;
  }

  private validUuid(value: string | string[] | undefined): string | undefined {
    return typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : undefined;
  }
}
