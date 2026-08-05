import { Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import type { EmailService, SendEmailInput } from '@pratto/contracts';
import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

@Injectable()
export class MailpitEmailService implements EmailService {
  private readonly environment = loadEnvironment();
  private readonly transporter: Transporter = nodemailer.createTransport({
    host: this.environment.MAILPIT_SMTP_HOST,
    port: this.environment.MAILPIT_SMTP_PORT,
    secure: false,
  });

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({ from: this.environment.MAIL_FROM, ...input });
  }

  async health(): Promise<void> {
    await this.transporter.verify();
  }
}
