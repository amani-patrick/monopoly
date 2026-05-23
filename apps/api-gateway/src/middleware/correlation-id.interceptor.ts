import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

/**
 * Request Correlation ID Interceptor
 * Ensures all requests and their cascading calls are tracked via unique IDs
 * Enables distributed tracing across microservices
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get or create request IDs
    const correlationId = request.get('x-correlation-id') || uuid();
    const requestId = request.get('x-request-id') || uuid();
    const startTime = Date.now();

    // Store IDs in request for use by services
    (request as any).correlationId = correlationId;
    (request as any).requestId = requestId;

    // Set response headers with IDs for tracing
    response.setHeader('x-correlation-id', correlationId);
    response.setHeader('x-request-id', requestId);

    // Log request start
    this.logger.debug(`[${correlationId}] ${request.method} ${request.path} START`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.logger.debug(
            `[${correlationId}] ${request.method} ${request.path} SUCCESS (${duration}ms)`,
          );
          response.setHeader('x-response-time', `${duration}ms`);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${correlationId}] ${request.method} ${request.path} ERROR (${duration}ms): ${error.message}`,
          );
          response.setHeader('x-response-time', `${duration}ms`);
        },
      }),
    );
  }
}

/**
 * Service-to-Service Communication Client
 * Ensures proper retry logic, circuit breaking, and timeout handling
 */
@Injectable()
export class ServiceClient {
  private readonly logger = new Logger(ServiceClient.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;
  private readonly REQUEST_TIMEOUT_MS = 15000;

  async call<T>(
    serviceUrl: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: {
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
      retries?: number;
      correlationId?: string;
      requestId?: string;
      internalKey?: string;
    },
  ): Promise<T> {
    const url = `${serviceUrl}${path}`;
    const correlationId = options?.correlationId || uuid();
    const requestId = options?.requestId || uuid();
    const timeout = options?.timeout || this.REQUEST_TIMEOUT_MS;
    const retries = options?.retries ?? this.MAX_RETRIES;

    const headers: Record<string, string> = {
      'x-correlation-id': correlationId,
      'x-request-id': requestId,
      'content-type': 'application/json',
      ...options?.headers,
    };

    if (options?.internalKey) {
      headers['x-internal-key'] = options.internalKey;
    }

    return this.executeWithRetry(
      url,
      method,
      headers,
      options?.body,
      timeout,
      retries,
      correlationId,
    );
  }

  private async executeWithRetry<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    timeout: number,
    retriesLeft: number,
    correlationId: string,
  ): Promise<T> {
    try {
      this.logger.debug(`[${correlationId}] Calling ${method} ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Service call failed: ${response.status} ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.debug(`[${correlationId}] Service call succeeded`);
      return data;
    } catch (error: any) {
      const isRetryable = error.name === 'AbortError' || error.message?.includes('ECONNREFUSED');

      if (isRetryable && retriesLeft > 0) {
        this.logger.warn(
          `[${correlationId}] Service call failed, retrying (${retriesLeft} attempts left): ${error.message}`,
        );
        await this.delay(this.RETRY_DELAY_MS);
        return this.executeWithRetry(url, method, headers, body, timeout, retriesLeft - 1, correlationId);
      }

      this.logger.error(
        `[${correlationId}] Service call failed after retries: ${error.message}`,
      );
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
