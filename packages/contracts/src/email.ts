export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
  health(): Promise<void>;
}

export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');
