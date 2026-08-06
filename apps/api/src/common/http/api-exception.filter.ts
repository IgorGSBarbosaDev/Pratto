import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError } from '@pratto/contracts';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = request.header('x-request-id') ?? undefined;
    if (request.path.startsWith('/auth/')) response.setHeader('Cache-Control', 'no-store');
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const structured =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Partial<ApiError>)
        : undefined;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (structured?.message ?? 'Unexpected server error');
    const body: ApiError = {
      statusCode,
      code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : (structured?.code ?? 'REQUEST_ERROR'),
      message,
      ...(structured?.details === undefined ? {} : { details: structured.details }),
      ...(requestId ? { requestId } : {}),
    };

    if (
      statusCode === HttpStatus.TOO_MANY_REQUESTS &&
      structured?.details &&
      typeof structured.details === 'object' &&
      'retryAfter' in structured.details &&
      typeof structured.details.retryAfter === 'number'
    ) {
      response.setHeader('Retry-After', structured.details.retryAfter.toString());
    }

    response.status(statusCode).json(body);
  }
}
