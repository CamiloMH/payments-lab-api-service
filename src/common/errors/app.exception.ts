import { HttpException, type HttpStatus } from '@nestjs/common';
import type { AppErrorCode } from './app-error-code';

/** Cuerpo que `AppException.getResponse()` expone al `HttpExceptionFilter`. */
export interface AppExceptionBody {
  code: AppErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Base de todas las excepciones de dominio de la API. Además del status
 * HTTP heredado de `HttpException`, adjunta un `code` estable de máquina
 * (`AppErrorCode`) para que el front discrimine el error sin parsear
 * `message`, que es texto en español pensado para humanos, no para lógica.
 */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: AppErrorCode, message: string, details?: unknown) {
    const body: AppExceptionBody =
      details === undefined ? { code, message } : { code, message, details };
    super(body, status);
  }
}
