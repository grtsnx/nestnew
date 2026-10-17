import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { useLogger } from 'evlog/nestjs';

import { handleResponse } from './responseHandler.filter';

function isUnexpectedError(exception: unknown): boolean {
  if (exception instanceof handleResponse) {
    return false;
  }
  if (exception instanceof HttpException) {
    return exception.getStatus() >= 500;
  }
  return true;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (isUnexpectedError(exception)) {
      try {
        const error =
          exception instanceof Error ? exception : new Error(String(exception));
        useLogger().error(error);
      } catch {
        // Outside an evlog request scope — logger is unavailable
      }
    }

    if (exception instanceof handleResponse) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      let message: string;
      let data: unknown;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const obj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          data = { errors: obj.message };
        } else {
          message =
            typeof obj.message === 'string' ? obj.message : exception.message;
        }
      } else {
        message = exception.message;
      }

      const body = new handleResponse(status, message, data).getResponse();
      response.status(status).json(body);
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const data = this.isProduction
      ? undefined
      : {
          stack: exception instanceof Error ? exception.stack : undefined,
        };

    const body = new handleResponse(
      status,
      this.isProduction ? 'Internal server error' : message,
      data,
    ).getResponse();

    response.status(status).json(body);
  }
}
