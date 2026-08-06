import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { AuthService } from '../../identity/application/auth.service';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new StableHttpException(
        HttpStatus.UNAUTHORIZED,
        'AUTHENTICATION_REQUIRED',
        'Autenticação obrigatória.',
      );
    }
    request.tenant = await this.authService.resolveTenantPrincipal(request.auth);
    return true;
  }
}
