import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@pratto/contracts';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';

import { REQUIRED_PERMISSIONS } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    if (hasPermission(tenant.role, permission)) return true;

    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'PERMISSION_DENIED',
      'Seu perfil não possui permissão para esta operação.',
      { permission },
    );
  }
}
