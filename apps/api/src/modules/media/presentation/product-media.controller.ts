import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { ProductMediaListResponse, ProductMediaResponse } from '@pratto/contracts';
import {
  catalogMenuIdSchema,
  productIdSchema,
  productMediaIdSchema,
  productMediaReorderSchema,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import {
  MAX_PRODUCT_MEDIA_SIZE_BYTES,
  ProductMediaService,
  type ProductMediaUploadFile,
} from '../application/product-media.service';

@ApiTags('Product media')
@ApiCookieAuth('pratto_session')
@Controller('admin')
@UseGuards(AuthenticatedGuard, OrganizationGuard)
export class ProductMediaController {
  constructor(@Inject(ProductMediaService) private readonly service: ProductMediaService) {}

  @Get('menus/:menuId/products/:productId/media')
  @ApiOperation({ summary: 'List product media for the active organization' })
  listMedia(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductMediaListResponse> {
    return this.service.listMedia(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
    );
  }

  @Post('menus/:menuId/products/:productId/media')
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PRODUCT_MEDIA_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image or video for a product' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadMedia(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @UploadedFile() file: ProductMediaUploadFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductMediaResponse> {
    return this.service.uploadMedia(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
      file,
    );
  }

  @Post('menus/:menuId/products/:productId/media/:mediaId/primary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Set a product media item as primary' })
  setPrimary(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductMediaListResponse> {
    return this.service.setPrimary(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
      this.parseId(mediaId, productMediaIdSchema),
    );
  }

  @Patch('menus/:menuId/products/:productId/media/reorder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Reorder all product media items' })
  reorderMedia(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductMediaListResponse> {
    const input = productMediaReorderSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.reorderMedia(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
      input.data,
    );
  }

  @Delete('menus/:menuId/products/:productId/media/:mediaId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Remove a product media item' })
  removeMedia(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductMediaListResponse> {
    return this.service.removeMedia(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
      this.parseId(mediaId, productMediaIdSchema),
    );
  }

  private parseId(value: string, schema: typeof catalogMenuIdSchema): string {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Os dados enviados são inválidos.',
      result.error.flatten(),
    );
  }

  private invalidBody(details: unknown): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Os dados enviados são inválidos.',
      details,
    );
  }
}
