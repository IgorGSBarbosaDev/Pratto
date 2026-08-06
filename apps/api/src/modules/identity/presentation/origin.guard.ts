import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import type { Request } from 'express';

import { StableHttpException } from '../../../common/http/stable-http.exception';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly expectedOrigin = new URL(loadEnvironment().WEB_URL).origin;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.header('origin');
    const referer = request.header('referer');
    const actualOrigin = origin ?? this.originFromReferer(referer);
    if (actualOrigin === this.expectedOrigin) return true;

    throw new StableHttpException(
      HttpStatus.FORBIDDEN,
      'ORIGIN_INVALID',
      'A origem da requisição não é permitida.',
    );
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
