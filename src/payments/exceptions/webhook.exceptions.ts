import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** La firma HMAC del webhook entrante no coincide con la calculada con el secreto configurado. */
export class WebhookSignatureInvalidException extends AppException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      AppErrorCode.WebhookSignatureInvalid,
      'Firma de webhook de Mercado Pago inválida',
    );
  }
}
