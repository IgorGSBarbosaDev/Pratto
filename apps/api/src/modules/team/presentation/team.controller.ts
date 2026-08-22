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
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  InvitationAcceptanceResponse,
  InvitationPreviewResponse,
  TeamInvitation,
  TeamMember,
  TeamResponse,
} from '@pratto/contracts';
import { Permission } from '@pratto/contracts';
import {
  invitationAcceptSchema,
  invitationPreviewSchema,
  establishmentIdSchema,
  teamInviteSchema,
  teamMembershipIdSchema,
  teamRoleUpdateSchema,
} from '@pratto/validation';

import { StableHttpException } from '../../../common/http/stable-http.exception';
import { PermissionGuard } from '../../authorization/presentation/permission.guard';
import { RequirePermission } from '../../authorization/presentation/require-permission.decorator';
import type { AuthenticatedRequest } from '../../identity/domain/auth.types';
import { AuthenticatedGuard } from '../../identity/presentation/authenticated.guard';
import { CsrfGuard } from '../../identity/presentation/csrf.guard';
import { OriginGuard } from '../../identity/presentation/origin.guard';
import { OrganizationGuard } from '../../organizations/presentation/organization.guard';
import { TeamService } from '../application/team.service';

@ApiTags('Team')
@ApiCookieAuth('pratto_session')
@Controller('admin/establishments')
@UseGuards(AuthenticatedGuard, OrganizationGuard, PermissionGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly service: TeamService) {}

  @Get(':establishmentId/team')
  @RequirePermission(Permission.TEAM_READ)
  getTeam(
    @Param('establishmentId') establishmentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamResponse> {
    return this.service.getTeam(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
    );
  }

  @Post(':establishmentId/team/invitations')
  @UseGuards(CsrfGuard)
  @RequirePermission(Permission.TEAM_INVITE)
  invite(
    @Param('establishmentId') establishmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamInvitation> {
    const input = teamInviteSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.invite(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
      input.data,
    );
  }

  @Post(':establishmentId/team/invitations/:invitationId/resend')
  @UseGuards(CsrfGuard)
  @RequirePermission(Permission.TEAM_INVITE)
  resend(
    @Param('establishmentId') establishmentId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamInvitation> {
    return this.service.resend(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
      this.parseUuid(invitationId, teamMembershipIdSchema),
    );
  }

  @Delete(':establishmentId/team/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  @RequirePermission(Permission.TEAM_INVITE)
  async cancel(
    @Param('establishmentId') establishmentId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.cancel(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
      this.parseUuid(invitationId, teamMembershipIdSchema),
    );
  }

  @Patch(':establishmentId/team/members/:membershipId')
  @UseGuards(CsrfGuard)
  @RequirePermission(Permission.TEAM_MANAGE)
  updateMember(
    @Param('establishmentId') establishmentId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamMember> {
    const input = teamRoleUpdateSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.updateMember(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
      this.parseUuid(membershipId, teamMembershipIdSchema),
      input.data,
    );
  }

  @Delete(':establishmentId/team/members/:membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  @RequirePermission(Permission.TEAM_MANAGE)
  async removeMember(
    @Param('establishmentId') establishmentId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.removeMember(
      request.tenant!,
      this.parseUuid(establishmentId, establishmentIdSchema),
      this.parseUuid(membershipId, teamMembershipIdSchema),
    );
  }

  private parseUuid(
    value: string,
    schema: typeof establishmentIdSchema | typeof teamMembershipIdSchema,
  ): string {
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

@Controller()
@UseGuards(OriginGuard)
export class PublicInvitationController {
  constructor(@Inject(TeamService) private readonly service: TeamService) {}

  @Post('invitations/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inspect a membership invitation without exposing its token' })
  @ApiBody({ required: true })
  preview(@Body() body: unknown): Promise<InvitationPreviewResponse> {
    const input = invitationPreviewSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.preview(input.data.token);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a membership invitation and create access if necessary' })
  @ApiBody({ required: true })
  accept(@Body() body: unknown): Promise<InvitationAcceptanceResponse> {
    const input = invitationAcceptSchema.safeParse(body);
    if (!input.success) this.invalidBody(input.error.flatten());
    return this.service.accept(input.data);
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
