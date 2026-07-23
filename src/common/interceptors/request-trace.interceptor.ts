import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, catchError, tap, throwError } from 'rxjs';

import { formatLogFields } from '../logging/format-log-fields';

/**
 * Traza cada request HTTP: una línea al entrar y otra al salir (con status y
 * duración). El error se re-lanza intacto para que `HttpExceptionFilter` lo
 * siga procesando. El formato es solo `campo: valor` (sin texto de acción),
 * consistente con los logs de negocio.
 */
@Injectable()
export class RequestTraceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const path = request.url;
    const start = Date.now();

    this.logger.log(formatLogFields({ method, path }));

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          formatLogFields({ method, path, status: response.statusCode, ms: Date.now() - start }),
        );
      }),
      catchError((error: unknown) => {
        this.logger.warn(formatLogFields({ method, path, ms: Date.now() - start }));
        return throwError(() => error);
      }),
    );
  }
}
