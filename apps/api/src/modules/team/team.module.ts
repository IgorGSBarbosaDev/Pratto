import { Module } from '@nestjs/common';

import { EmailModule } from '../../infrastructure/email/email.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';

import { TeamService } from './application/team.service';
import { PublicInvitationController, TeamController } from './presentation/team.controller';

@Module({
  imports: [AuthorizationModule, EmailModule, IdentityModule, OrganizationsModule],
  controllers: [TeamController, PublicInvitationController],
  providers: [TeamService],
})
export class TeamModule {}
