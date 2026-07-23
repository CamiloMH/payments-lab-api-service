import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';

import { AppErrorCode } from '../errors/app-error-code';

/** Forma uniforme de error para toda la API, incluidas excepciones no manejadas. */
interface ErrorResponseBody {
  statusCode: number;
  code: AppErrorCode;
  message: string | string[];
  details?: unknown;
  timestamp: string;
  path: string;
}

/**
 * Códigos de respaldo para excepciones que no son `AppException` (validación
 * Zod, `ThrottlerGuard`, ruta inexistente que genera Nest, o cualquier 500 no
 * anticipado). Una `AppException` siempre trae su propio `code` en el body.
 */
function fallbackErrorCode(status: number): AppErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return AppErrorCode.ValidationFailed;
    case HttpStatus.NOT_FOUND:
      return AppErrorCode.RouteNotFound;
    case HttpStatus.TOO_MANY_REQUESTS:
      return AppErrorCode.TooManyRequests;
    default:
      return AppErrorCode.InternalError;
  }
}

/**
 * Normaliza cualquier excepción (HTTP o no) a un cuerpo JSON consistente y
 * registra las no controladas (500) con su stack para depuración. El `code`
 * es el contrato estable que el front usa para discriminar errores; el
 * `message` es texto en español para mostrar a un humano.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : null;
    const bodyIsObject = typeof body === 'object' && body !== null;

    const message =
      bodyIsObject && 'message' in body
        ? (body as { message: string | string[] }).message
        : isHttpException
          ? exception.message
          : 'Error interno del servidor';

    const code =
      bodyIsObject && 'code' in body
        ? (body as { code: AppErrorCode }).code
        : fallbackErrorCode(status);

    const details =
      bodyIsObject && 'details' in body ? (body as { details: unknown }).details : undefined;

    // Los 5xx (no controlados o HTTP explícitos) son fallos reales: se loguean
    // con stack y se reportan a Sentry. `captureException` es no-op sin DSN.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      if (!isHttpException) {
        this.logger.error(exception instanceof Error ? exception.stack : exception);
      }
      Sentry.captureException(exception);
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(payload);
  }
}
