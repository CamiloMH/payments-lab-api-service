import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../errors/app-error-code';
import { AppException } from '../errors/app.exception';

/**
 * Se superó el rate-limit (protección DoS). La lanza `AppThrottlerGuard` en
 * lugar de la excepción por defecto del paquete, para que el 429 también lleve
 * su `code` estable (`TOO_MANY_REQUESTS`) y un mensaje en español.
 */
export class TooManyRequestsException extends AppException {
  constructor() {
    super(
      HttpStatus.TOO_MANY_REQUESTS,
      AppErrorCode.TooManyRequests,
      'Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.',
    );
  }
}
