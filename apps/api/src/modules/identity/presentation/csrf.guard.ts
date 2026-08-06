import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { CSRF_COOKIE, CSRF_HEADER } from '../domain/auth.constants';
import { verifyCsrfToken } from '../domain/auth.crypto';
import type { AuthenticatedRequest } from '../domain/auth.types';

import { readCookie } from './cookies';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly environment = loadEnvironment();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = readCookie(request, CSRF_COOKIE);
    const header = request.header(CSRF_HEADER);
    const sessionId = request.auth?.sessionId;
    if (
      sessionId &&
      cookie &&
      header &&
      cookie === header &&
      verifyCsrfToken(this.environment.COOKIE_SECRET, sessionId, header)
    ) {
      return true;
    }

    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'CSRF_TOKEN_INVALID',
      'A prova CSRF é inválida ou está ausente.',
    );
  }
}
