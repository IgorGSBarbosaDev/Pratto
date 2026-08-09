import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  CategoryListResponse,
  CategoryResponse,
  MenuListResponse,
  ProductListResponse,
  ProductResponse,
} from '@pratto/contracts';
import {
  catalogMenuIdSchema,
  categoryCreateSchema,
  categoryIdSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  establishmentIdSchema,
  productCreateSchema,
  productIdSchema,
  productReorderSchema,
  productUpdateSchema,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { CatalogService } from '../application/catalog.service';

@ApiTags('Catalog')
@ApiCookieAuth('pratto_session')
@Controller('admin')
@UseGuards(AuthenticatedGuard, OrganizationGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}

  @Get('menus/:menuId/categories')
  @ApiOperation({ summary: 'List menu categories for the active organization' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  listCategories(
    @Param('menuId') menuId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryListResponse> {
    return this.service.listCategories(request.tenant!, this.parseId(menuId, catalogMenuIdSchema));
  }

  @Get('menus/:menuId/products')
  @ApiOperation({ summary: 'List menu products for the active organization' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  listProducts(
    @Param('menuId') menuId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductListResponse> {
    return this.service.listProducts(request.tenant!, this.parseId(menuId, catalogMenuIdSchema));
  }

  @Get('establishments/:establishmentId/menus')
  @ApiOperation({ summary: 'List editable menus available for the establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  listEstablishmentMenus(
    @Param('establishmentId') establishmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MenuListResponse> {
    return this.service.listMenusForEstablishment(
      request.tenant!,
      this.parseId(establishmentId, establishmentIdSchema),
    );
  }

  @Post('menus/:menuId/categories')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Create a menu category' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiBody({ description: 'Validated category data', required: true })
  createCategory(
    @Param('menuId') menuId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryResponse> {
    const input = categoryCreateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.createCategory(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      input.data,
    );
  }

  @Post('menus/:menuId/products')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Create a menu product' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiBody({ description: 'Validated product data', required: true })
  createProduct(
    @Param('menuId') menuId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductResponse> {
    const input = productCreateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.createProduct(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      input.data,
    );
  }

  @Patch('menus/:menuId/categories/reorder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Reorder all non-archived menu categories' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  reorderCategories(
    @Param('menuId') menuId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryListResponse> {
    const input = categoryReorderSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.reorderCategories(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      input.data,
    );
  }

  @Patch('menus/:menuId/categories/:categoryId')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Edit a menu category' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  updateCategory(
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryResponse> {
    const input = categoryUpdateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.updateCategory(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(categoryId, categoryIdSchema),
      input.data,
    );
  }

  @Post('menus/:menuId/categories/:categoryId/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Activate a menu category' })
  activateCategory(
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryResponse> {
    return this.service.activateCategory(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(categoryId, categoryIdSchema),
    );
  }

  @Post('menus/:menuId/categories/:categoryId/deactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Deactivate a menu category' })
  deactivateCategory(
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryResponse> {
    return this.service.deactivateCategory(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(categoryId, categoryIdSchema),
    );
  }

  @Post('menus/:menuId/categories/:categoryId/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Archive a menu category without destructive deletion' })
  archiveCategory(
    @Param('menuId') menuId: string,
    @Param('categoryId') categoryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CategoryResponse> {
    return this.service.archiveCategory(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(categoryId, categoryIdSchema),
    );
  }

  @Post('menus/:menuId/products/:productId/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Activate a menu product' })
  activateProduct(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductResponse> {
    return this.service.activateProduct(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
    );
  }

  @Post('menus/:menuId/products/:productId/deactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Deactivate a menu product' })
  deactivateProduct(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductResponse> {
    return this.service.deactivateProduct(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
    );
  }

  @Post('menus/:menuId/products/:productId/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Archive a menu product without destructive deletion' })
  archiveProduct(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductResponse> {
    return this.service.archiveProduct(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
    );
  }

  @Patch('menus/:menuId/products/reorder')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Reorder all non-archived menu products' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  reorderProducts(
    @Param('menuId') menuId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductListResponse> {
    const input = productReorderSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.reorderProducts(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      input.data,
    );
  }

  @Patch('menus/:menuId/products/:productId')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Edit a menu product' })
  @ApiParam({ name: 'menuId', format: 'uuid' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  updateProduct(
    @Param('menuId') menuId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductResponse> {
    const input = productUpdateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.updateProduct(
      request.tenant!,
      this.parseId(menuId, catalogMenuIdSchema),
      this.parseId(productId, productIdSchema),
      input.data,
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
