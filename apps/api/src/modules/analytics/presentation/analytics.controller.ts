import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AnalyticsIngestResponse, AnalyticsSessionResponse } from '@pratto/contracts';
import { analyticsIngestSchema, analyticsSessionSchema } from '@pratto/validation';
import type { Request } from 'express';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { AnalyticsService, mapAnalyticsError } from '../application/analytics.service';

@ApiTags('Public analytics')
@Controller('public/analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly service: AnalyticsService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or resume an anonymous public-menu session' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Anonymous analytics session' })
  createSession(@Body() body: unknown, @Req() request: Request): Promise<AnalyticsSessionResponse> {
    const parsed = analyticsSessionSchema.safeParse(body);
    if (!parsed.success) this.invalidInput(parsed.error.flatten());
    return this.service
      .createOrReuseSession(parsed.data, request.ip ?? 'unknown')
      .catch(mapAnalyticsError);
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest a bounded batch of anonymous public-menu events' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Per-event ingestion results' })
  ingest(@Body() body: unknown, @Req() request: Request): Promise<AnalyticsIngestResponse> {
    const parsed = analyticsIngestSchema.safeParse(body);
    if (!parsed.success) this.invalidInput(parsed.error.flatten());
    return this.service.ingest(parsed.data, request.ip ?? 'unknown').catch(mapAnalyticsError);
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
