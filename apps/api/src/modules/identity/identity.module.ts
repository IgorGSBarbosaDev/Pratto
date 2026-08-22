import { Module } from '@nestjs/common';

import { NoStoreInterceptor } from '../../common/http/no-store.interceptor';
import { EmailModule } from '../../infrastructure/email/email.module';

import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { RateLimitService } from './application/rate-limit.service';
import { AuthController } from './presentation/auth.controller';
import { AuthenticatedGuard } from './presentation/authenticated.guard';
import { CsrfGuard } from './presentation/csrf.guard';
import { OriginGuard } from './presentation/origin.guard';

@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    RateLimitService,
    AuthenticatedGuard,
    CsrfGuard,
    OriginGuard,
    NoStoreInterceptor,
  ],
  exports: [AuthService, AuthenticatedGuard, CsrfGuard, PasswordService],
})
export class IdentityModule {}
