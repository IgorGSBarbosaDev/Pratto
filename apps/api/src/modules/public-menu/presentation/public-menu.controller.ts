import { Controller, Get, HttpStatus, Inject, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { PublicMenuPageResponse } from '@pratto/contracts';
import { publicIdSchema, publicMenuQuerySchema } from '@pratto/validation';

import { NoStoreInterceptor } from '../../../common/http/no-store.interceptor';
import { StableHttpException } from '../../../common/http/stable-http.exception';
import { mapPublicMenuError, PublicMenuService } from '../application/public-menu.service';

@ApiTags('Public menu')
@Controller('public/establishments')
@UseInterceptors(NoStoreInterceptor)
export class PublicMenuController {
  constructor(@Inject(PublicMenuService) private readonly service: PublicMenuService) {}

  @Get(':publicId/menu')
  @ApiOperation({ summary: 'Read the active public menu publication' })
  @ApiParam({ name: 'publicId', description: 'Stable public establishment identifier' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque feed cursor' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, maximum: 12, default: 6 })
  @ApiResponse({ status: HttpStatus.OK, description: 'Published public menu page' })
  getPage(
    @Param('publicId') publicId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<PublicMenuPageResponse> {
    const publicIdResult = publicIdSchema.safeParse(publicId);
    if (!publicIdResult.success) this.invalidInput(publicIdResult.error.flatten());
    const queryResult = publicMenuQuerySchema.safeParse(query);
    if (!queryResult.success) this.invalidInput(queryResult.error.flatten());
    return this.service.getPage(publicIdResult.data, queryResult.data).catch(mapPublicMenuError);
  }

  private invalidInput(details: unknown): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Os dados enviados são inválidos.',
      details,
    );
  }
}
