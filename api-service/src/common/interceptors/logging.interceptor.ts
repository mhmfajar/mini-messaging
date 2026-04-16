import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

interface CorrelationRequest extends Request {
  correlationId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<CorrelationRequest>();
    const method = request.method;
    const url = request.url;
    const body = request.body as unknown;
    const correlationId =
      (request.headers['x-correlation-id'] as string) || randomUUID();
    const startTime = Date.now();

    // Attach correlation ID to request for downstream use
    request.correlationId = correlationId;

    this.logger.log(
      JSON.stringify({
        correlationId,
        type: 'REQUEST',
        method,
        url,
        body: method !== 'GET' ? body : undefined,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse<Response>();
          this.logger.log(
            JSON.stringify({
              correlationId,
              type: 'RESPONSE',
              method,
              url,
              statusCode: response.statusCode,
              duration: `${duration}ms`,
            }),
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            JSON.stringify({
              correlationId,
              type: 'ERROR',
              method,
              url,
              error: error.message,
              duration: `${duration}ms`,
            }),
          );
        },
      }),
    );
  }
}
