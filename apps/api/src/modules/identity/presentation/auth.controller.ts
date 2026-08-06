import type { HttpException } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { loadEnvironment } from '@pratto/config';
import type { AcceptedResponse, AuthContextResponse, CsrfResponse } from '@pratto/contracts';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  selectOrganizationSchema,
} from '@pratto/validation';
import type { Request, Response } from 'express';
import type { ZodSchema } from 'zod';

import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor';
import { StableHttpException } from '../../../common/http/stable-http.exception';
import { AuthService } from '../application/auth.service';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../domain/auth.constants';
import { createCsrfToken, verifyCsrfToken } from '../domain/auth.crypto';
import type { AuthenticatedRequest } from '../domain/auth.types';

import { AuthenticatedGuard } from './authenticated.guard';
import { clearAuthCookies, readCookie, setCsrfCookie, setSessionCookie } from './cookies';
import { CsrfGuard } from './csrf.guard';
import { OriginGuard } from './origin.guard';

const loginBody = {
  schema: {
    type: 'object',
    required: ['email', 'password'],
    properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
  },
};

const authOrganizationSchema = {
  type: 'object',
  required: ['id', 'name', 'membershipId', 'role'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    membershipId: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
  },
};

const authContextSchema = {
  type: 'object',
  required: [
    'user',
    'activeOrganization',
    'organizations',
    'establishments',
    'organizationSelectionRequired',
  ],
  properties: {
    user: {
      type: 'object',
      required: ['id', 'email', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
      },
    },
    activeOrganization: {
      nullable: true,
      ...authOrganizationSchema,
    },
    organizations: {
      type: 'array',
      items: authOrganizationSchema,
    },
    establishments: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'publicId', 'name', 'slug'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          publicId: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
    organizationSelectionRequired: { type: 'boolean' },
  },
};

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(NoStoreInterceptor)
export class AuthController {
  private readonly environment = loadEnvironment();

  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  @ApiOperation({ summary: 'Create an opaque administrative session' })
  @ApiBody(loginBody)
  @ApiResponse({ status: 200, description: 'Authenticated context', schema: authContextSchema })
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthContextResponse> {
    const input = this.parse(loginSchema, body);
    const result = await this.authService.login(input, this.clientTracker(request));
    const csrfToken = createCsrfToken(this.environment.COOKIE_SECRET, result.sessionId);
    setSessionCookie(response, this.environment, result.token, result.expiresAt);
    setCsrfCookie(response, this.environment, csrfToken, result.expiresAt);
    return result.context;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  @ApiOperation({ summary: 'Revoke the current session idempotently' })
  @ApiResponse({ status: 204, description: 'Session revoked or already absent' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      try {
        const principal = await this.authService.authenticate(token);
        const csrfCookie = readCookie(request, CSRF_COOKIE);
        const csrfHeader = request.header(CSRF_HEADER);
        if (
          !csrfCookie ||
          csrfCookie !== csrfHeader ||
          !verifyCsrfToken(this.environment.COOKIE_SECRET, principal.sessionId, csrfCookie)
        ) {
          throw new StableHttpException(
            HttpStatus.FORBIDDEN,
            'CSRF_TOKEN_INVALID',
            'A prova CSRF é inválida ou está ausente.',
          );
        }
      } catch (error) {
        if (!this.isInactiveSession(error)) throw error;
      }
    }
    await this.authService.logout(token);
    clearAuthCookies(response, this.environment);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, CsrfGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(request.auth!);
    clearAuthCookies(response, this.environment);
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiResponse({ status: 200, description: 'Current safe context', schema: authContextSchema })
  getMe(@Req() request: AuthenticatedRequest): Promise<AuthContextResponse> {
    return this.authService.getContext(request.auth!);
  }

  @Post('select-organization')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, CsrfGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['membershipId'],
      properties: { membershipId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Selected organization context',
    schema: authContextSchema,
  })
  selectOrganization(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthContextResponse> {
    const input = this.parse(selectOrganizationSchema, body);
    return this.authService.selectOrganization(request.auth!, input.membershipId);
  }

  @Get('csrf')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      required: ['csrfToken'],
      properties: { csrfToken: { type: 'string' } },
    },
  })
  csrf(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): CsrfResponse {
    const token = createCsrfToken(this.environment.COOKIE_SECRET, request.auth!.sessionId);
    setCsrfCookie(response, this.environment, token, request.auth!.expiresAt);
    return { csrfToken: token };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OriginGuard)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  })
  @ApiResponse({
    status: 202,
    schema: {
      type: 'object',
      required: ['message'],
      properties: { message: { type: 'string' } },
    },
  })
  async forgotPassword(@Body() body: unknown, @Req() request: Request): Promise<AcceptedResponse> {
    const input = this.parse(forgotPasswordSchema, body);
    await this.authService.forgotPassword(input.email, this.clientTracker(request));
    return { message: 'Se a conta existir, as instruções serão enviadas.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: { token: { type: 'string' }, password: { type: 'string', minLength: 15 } },
    },
  })
  @ApiResponse({ status: 204, description: 'Password changed and sessions revoked' })
  async resetPassword(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const input = this.parse(resetPasswordSchema, body);
    await this.authService.resetPassword(input.token, input.password, this.clientTracker(request));
  }

  private parse<T>(schema: ZodSchema<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Os dados enviados são inválidos.',
      result.error.flatten(),
    );
  }

  private clientTracker(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private isInactiveSession(error: unknown): boolean {
    if (!(error instanceof StableHttpException)) return false;
    const response = (error as HttpException).getResponse();
    if (typeof response !== 'object' || response === null) return false;
    const code = (response as { code?: string }).code;
    return (
      code === 'SESSION_REVOKED' || code === 'SESSION_EXPIRED' || code === 'AUTHENTICATION_REQUIRED'
    );
  }
}
