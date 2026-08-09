import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AnalyticsDashboardCategoryMetric,
  AnalyticsDashboardProductMetric,
  AnalyticsDashboardResponse,
} from '@pratto/contracts';
import { prisma } from '@pratto/database';
import type { AnalyticsDashboardQueryInput } from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { TenantPrincipal } from '../../identity/domain/auth.types';

import { AnalyticsQueryService, type AnalyticsQueryScope } from './analytics-query.service';

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    @Inject(AnalyticsQueryService) private readonly queryService: AnalyticsQueryService,
  ) {}

  async getDashboard(
    tenant: TenantPrincipal,
    establishmentId: string,
    input: AnalyticsDashboardQueryInput,
  ): Promise<AnalyticsDashboardResponse> {
    await this.assertEstablishment(tenant, establishmentId);
    await this.assertFilters(tenant.organizationId, establishmentId, input);

    const scope: AnalyticsQueryScope = {
      organizationId: tenant.organizationId,
      establishmentId,
      from: new Date(input.from),
      to: new Date(input.to),
      categoryId: input.categoryId,
      productId: input.productId,
    };

    const [summary, daily, products, categories, filters] = await Promise.all([
      this.queryService.summary(scope),
      this.queryService.daily(scope),
      this.queryService.products(scope),
      this.queryService.categories(scope),
      this.listFilterOptions(tenant.organizationId, establishmentId),
    ]);

    const productById = new Map(filters.products.map((product) => [product.id, product]));
    const categoryById = new Map(filters.categories.map((category) => [category.id, category]));

    return {
      period: { from: scope.from.toISOString(), to: scope.to.toISOString() },
      summary,
      daily,
      products: products.map((metric) => this.toProductMetric(metric, productById)),
      categories: categories.map((metric) => this.toCategoryMetric(metric, categoryById)),
      filters,
    };
  }

  private async assertEstablishment(
    tenant: TenantPrincipal,
    establishmentId: string,
  ): Promise<void> {
    if (!tenant.establishmentIds.includes(establishmentId)) this.establishmentNotFound();
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId, organizationId: tenant.organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!establishment) this.establishmentNotFound();
  }

  private async assertFilters(
    organizationId: string,
    establishmentId: string,
    input: AnalyticsDashboardQueryInput,
  ): Promise<void> {
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: input.categoryId,
          organizationId,
          menu: { organizationId, establishmentId },
        },
        select: { id: true },
      });
      if (!category) this.invalidFilter();
    }

    if (input.productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: input.productId,
          organizationId,
          menu: { organizationId, establishmentId },
        },
        select: { id: true, categoryId: true },
      });
      if (!product || (input.categoryId && product.categoryId !== input.categoryId)) {
        this.invalidFilter();
      }
    }
  }

  private async listFilterOptions(organizationId: string, establishmentId: string) {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { organizationId, menu: { organizationId, establishmentId } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { organizationId, menu: { organizationId, establishmentId } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    return {
      categories: categories.map((category) => ({ id: category.id, name: category.name })),
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: product.category.name,
      })),
    };
  }

  private toProductMetric(
    metric: {
      productId: string;
      impressions: number;
      qualifiedViews: number;
      interactions: number;
    },
    products: ReadonlyMap<
      string,
      { id: string; name: string; categoryId: string; categoryName: string }
    >,
  ): AnalyticsDashboardProductMetric {
    const product = products.get(metric.productId);
    return {
      ...metric,
      name: product?.name ?? 'Produto não encontrado',
      categoryId: product?.categoryId ?? '',
      categoryName: product?.categoryName ?? 'Categoria não encontrada',
    };
  }

  private toCategoryMetric(
    metric: { categoryId: string; views: number },
    categories: ReadonlyMap<string, { id: string; name: string }>,
  ): AnalyticsDashboardCategoryMetric {
    return {
      ...metric,
      name: categories.get(metric.categoryId)?.name ?? 'Categoria não encontrada',
    };
  }

  private establishmentNotFound(): never {
    throw new StableHttpException(
      HttpStatus.NOT_FOUND,
      'ESTABLISHMENT_NOT_FOUND',
      'Estabelecimento não encontrado.',
    );
  }

  private invalidFilter(): never {
    throw new StableHttpException(
      HttpStatus.BAD_REQUEST,
      'ANALYTICS_FILTER_INVALID',
      'O filtro não pertence ao estabelecimento selecionado.',
    );
  }
}
