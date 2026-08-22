import { Controller, Get, HttpStatus, Inject, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { PublicMenuPageResponse, PublicMenuRelatedProductsResponse } from '@pratto/contracts';
import { categoryIdSchema, publicIdSchema, publicMenuQuerySchema } from '@pratto/validation';

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
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search product name, description or category',
  })
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

  @Get(':publicId/menu/products/:productId/related')
  @ApiOperation({ summary: 'Read deterministic related products from the active publication' })
  @ApiParam({ name: 'publicId', description: 'Stable public establishment identifier' })
  @ApiParam({ name: 'productId', description: 'Published product identifier', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Related published public products' })
  getRelated(
    @Param('publicId') publicId: string,
    @Param('productId') productId: string,
  ): Promise<PublicMenuRelatedProductsResponse> {
    const publicIdResult = publicIdSchema.safeParse(publicId);
    if (!publicIdResult.success) this.invalidInput(publicIdResult.error.flatten());
    const productIdResult = categoryIdSchema.safeParse(productId);
    if (!productIdResult.success) this.invalidInput(productIdResult.error.flatten());
    return this.service
      .getRelated(publicIdResult.data, productIdResult.data)
      .catch(mapPublicMenuError);
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
