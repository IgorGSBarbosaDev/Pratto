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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { EstablishmentSettingsResponse } from '@pratto/contracts';
import { Permission } from '@pratto/contracts';
import {
  establishmentAssetKindSchema,
  establishmentIdSchema,
  establishmentUpdateSchema,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { PermissionGuard } from '../../authorization/presentation/permission.guard';
import { RequirePermission } from '../../authorization/presentation/require-permission.decorator';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import {
  EstablishmentService,
  type EstablishmentUploadFile,
} from '../application/establishment.service';

@ApiTags('Establishments')
@ApiCookieAuth('pratto_session')
@Controller('admin/establishments')
@UseGuards(AuthenticatedGuard, OrganizationGuard, PermissionGuard)
export class EstablishmentController {
  constructor(@Inject(EstablishmentService) private readonly service: EstablishmentService) {}

  @Get(':establishmentId/settings')
  @RequirePermission(Permission.ESTABLISHMENT_READ)
  @ApiOperation({ summary: 'Read the current organization establishment settings' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Establishment settings' })
  getSettings(
    @Param('establishmentId') establishmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EstablishmentSettingsResponse> {
    return this.service.getSettings(request.tenant!, this.parseId(establishmentId));
  }

  @Patch(':establishmentId/settings')
  @RequirePermission(Permission.ESTABLISHMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Update public establishment settings' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiBody({ description: 'Validated establishment settings', required: true })
  @ApiResponse({ status: 200, description: 'Updated establishment settings' })
  updateSettings(
    @Param('establishmentId') establishmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<EstablishmentSettingsResponse> {
    const input = establishmentUpdateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.updateSettings(request.tenant!, this.parseId(establishmentId), input.data);
  }

  @Post(':establishmentId/assets/:assetKind')
  @RequirePermission(Permission.ESTABLISHMENT_UPDATE)
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the establishment logo or cover image' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'assetKind', enum: ['logo', 'cover'] })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated establishment settings' })
  uploadAsset(
    @Param('establishmentId') establishmentId: string,
    @Param('assetKind') assetKind: string,
    @UploadedFile() file: EstablishmentUploadFile | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<EstablishmentSettingsResponse> {
    const kind = establishmentAssetKindSchema.safeParse(assetKind);
    if (!kind.success) this.invalidBody(kind.error.flatten());
    return this.service.uploadAsset(
      request.tenant!,
      this.parseId(establishmentId),
      kind.data,
      file,
    );
  }

  @Delete(':establishmentId/assets/:assetKind')
  @RequirePermission(Permission.ESTABLISHMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Remove the establishment logo or cover image' })
  @ApiParam({ name: 'establishmentId', format: 'uuid' })
  @ApiParam({ name: 'assetKind', enum: ['logo', 'cover'] })
  @ApiResponse({ status: 200, description: 'Updated establishment settings' })
  removeAsset(
    @Param('establishmentId') establishmentId: string,
    @Param('assetKind') assetKind: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EstablishmentSettingsResponse> {
    const kind = establishmentAssetKindSchema.safeParse(assetKind);
    if (!kind.success) this.invalidBody(kind.error.flatten());
    return this.service.removeAsset(request.tenant!, this.parseId(establishmentId), kind.data);
  }

  private parseId(value: string): string {
    const result = establishmentIdSchema.safeParse(value);
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
