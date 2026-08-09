import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ActiveMenuPublicationResponse,
  MenuPublicationHistoryResponse,
  MenuPublicationResponse,
} from '@pratto/contracts';
import { catalogMenuIdSchema, publicationIdempotencyKeySchema } from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { PublicationService } from '../application/publication.service';

@ApiTags('Publications')
@ApiCookieAuth('pratto_session')
@Controller('admin/menus')
@UseGuards(AuthenticatedGuard, OrganizationGuard)
export class PublicationController {
  constructor(@Inject(PublicationService) private readonly service: PublicationService) {}

  @Post(':menuId/publications')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Publish an immutable menu snapshot' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Stable key for retrying the same publication request.',
  })
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } })
  @ApiResponse({ status: 200, description: 'Published menu snapshot' })
  publish(
    @Param('menuId') menuId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<MenuPublicationResponse> {
    return this.service.publish(
      request.tenant!,
      this.parseMenuId(menuId),
      this.parseIdempotencyKey(idempotencyKey),
    );
  }

  @Get(':menuId/publication')
  @ApiOperation({ summary: 'Read the active publication for a menu' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Active publication or null' })
  getActive(
    @Param('menuId') menuId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActiveMenuPublicationResponse> {
    return this.service.getActive(request.tenant!, this.parseMenuId(menuId));
  }

  @Get(':menuId/publications')
  @ApiOperation({ summary: 'List immutable menu publication versions' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Publication history' })
  listHistory(
    @Param('menuId') menuId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MenuPublicationHistoryResponse> {
    return this.service.listHistory(request.tenant!, this.parseMenuId(menuId));
  }

  private parseMenuId(value: string): string {
    const result = catalogMenuIdSchema.safeParse(value);
    if (result.success) return result.data;
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Os dados enviados são inválidos.',
      result.error.flatten(),
    );
  }

  private parseIdempotencyKey(value: string | undefined): string {
    const result = publicationIdempotencyKeySchema.safeParse(value);
    if (result.success) return result.data;
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'IDEMPOTENCY_KEY_INVALID',
      'A chave de idempotência deve ter entre 1 e 128 caracteres.',
      result.error.flatten(),
    );
  }
}
