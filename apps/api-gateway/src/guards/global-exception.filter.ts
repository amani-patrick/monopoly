import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { ApiErrorResponse, ErrorCode, ApiError } from '@umukino/shared-types';

/**
 * Global Exception Filter
 * Catches all exceptions and returns structured error responses
 * Provides request tracking, proper HTTP status codes, and detailed logging
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const traceId = uuid();
    const requestId = request.get('x-request-id') || uuid();
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: Record<string, any> | undefined;

    // Handle API Errors
    if (exception instanceof ApiError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    }
    // Handle NestJS HTTP exceptions
    else if (exception instanceof Error && (exception as any).status) {
      statusCode = (exception as any).status || HttpStatus.BAD_REQUEST;
      code = this.mapStatusToErrorCode(statusCode);
      message = (exception as any).message || 'Unknown error';

      // Extract detailed error info if available
      if ((exception as any).response?.message) {
        if (Array.isArray((exception as any).response.message)) {
          details = { errors: (exception as any).response.message };
        } else {
          message = (exception as any).response.message;
        }
      }
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message || 'Unknown error occurred';
      this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
    } else {
      message = String(exception);
      this.logger.error(`Unknown exception type: ${typeof exception}`);
    }

    // Log error
    this.logError({
      traceId,
      requestId,
      statusCode,
      code,
      message,
      method: request.method,
      path: request.path,
      query: request.query,
      userId: (request as any).user?.sub,
      exception,
    });

    // Build error response
    const errorResponse: ApiErrorResponse = {
      code,
      message,
      details,
      timestamp,
      traceId,
      requestId,
      path: request.path,
      statusCode,
    };

    // Send response
    httpAdapter.reply(response, errorResponse, statusCode);
  }

  private mapStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      case HttpStatus.REQUEST_TIMEOUT:
        return ErrorCode.TIMEOUT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private logError(context: {
    traceId: string;
    requestId: string;
    statusCode: number;
    code: ErrorCode;
    message: string;
    method: string;
    path: string;
    query: any;
    userId?: string;
    exception: unknown;
  }) {
    const logData = {
      traceId: context.traceId,
      requestId: context.requestId,
      statusCode: context.statusCode,
      code: context.code,
      message: context.message,
      request: {
        method: context.method,
        path: context.path,
        query: context.query,
      },
      userId: context.userId,
      timestamp: new Date().toISOString(),
    };

    if (context.statusCode >= 500) {
      this.logger.error(
        `[${context.traceId}] Server Error: ${context.code} - ${context.message}`,
        logData,
      );
    } else if (context.statusCode >= 400) {
      this.logger.warn(
        `[${context.traceId}] Client Error: ${context.code} - ${context.message}`,
      );
    } else {
      this.logger.debug(
        `[${context.traceId}] Response: ${context.code} - ${context.message}`,
      );
    }
  }
}
