import { HttpException } from '@nestjs/common';

export class StableHttpException extends HttpException {
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super({ statusCode, code, message, ...(details === undefined ? {} : { details }) }, statusCode);
  }
}
