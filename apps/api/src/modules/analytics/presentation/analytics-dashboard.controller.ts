import { Controller, Get, HttpStatus, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AnalyticsDashboardResponse } from '@pratto/contracts';
import { analyticsDashboardQuerySchema, establishmentIdSchema } from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { AnalyticsDashboardService } from '../application/analytics-dashboard.service';

@ApiTags('Analytics')
@ApiCookieAuth('pratto_session')
@Controller('admin/establishments')
@UseGuards(AuthenticatedGuard, OrganizationGuard)
export class AnalyticsDashboardController {
  constructor(
    @Inject(AnalyticsDashboardService) private readonly service: AnalyticsDashboardService,
  ) {}

  @Get(':establishmentId/analytics')
  @ApiOperation({ summary: 'Read aggregated analytics for an establishment' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiQuery({ name: 'from', required: true, format: 'date-time' })
  @ApiQuery({ name: 'to', required: true, format: 'date-time' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'productId', required: false, format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Aggregated establishment analytics' })
  getDashboard(
    @Param('establishmentId') establishmentId: string,
    @Query() query: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AnalyticsDashboardResponse> {
    const parsedQuery = analyticsDashboardQuerySchema.safeParse(query);
    if (!parsedQuery.success) this.invalidInput(parsedQuery.error.flatten());
    const parsedEstablishmentId = establishmentIdSchema.safeParse(establishmentId);
    if (!parsedEstablishmentId.success) this.invalidInput(parsedEstablishmentId.error.flatten());
    return this.service.getDashboard(request.tenant!, parsedEstablishmentId.data, parsedQuery.data);
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
