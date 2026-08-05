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
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof exceptionResponse === 'string' ? exceptionResponse : 'Unexpected server error';
    const body: ApiError = {
      statusCode,
      code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message,
      ...(requestId ? { requestId } : {}),
    };

    response.status(statusCode).json(body);
  }
}
