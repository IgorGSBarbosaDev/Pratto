import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import type { Response } from 'express';

import { AuthService } from '../application/auth.service';
import { SESSION_COOKIE } from '../domain/auth.constants';
import type { AuthenticatedRequest } from '../domain/auth.types';

import { readCookie, setSessionCookie } from './cookies';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  private readonly environment = loadEnvironment();

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const token = readCookie(request, SESSION_COOKIE);
    const principal = await this.authService.authenticate(token);
    request.auth = principal;
    if (principal.renewed) {
      setSessionCookie(response, this.environment, principal.rawToken, principal.expiresAt);
    }
    return true;
  }
}
