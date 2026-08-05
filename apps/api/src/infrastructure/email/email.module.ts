import { Module } from '@nestjs/common';
import { EMAIL_SERVICE } from '@pratto/contracts';

import { MailpitEmailService } from './mailpit-email.service';

@Module({
  providers: [{ provide: EMAIL_SERVICE, useClass: MailpitEmailService }],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
