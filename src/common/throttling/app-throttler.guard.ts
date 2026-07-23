import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { TooManyRequestsException } from './too-many-requests.exception';

/**
 * `ThrottlerGuard` global de la API. Sobrescribe la respuesta 429 para lanzar
 * una `AppException` con `code` `TOO_MANY_REQUESTS` y mensaje en español, en vez
 * de la excepción por defecto del paquete, de modo que toda respuesta de error
 * de la API tenga su código propio.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new TooManyRequestsException();
  }
}
