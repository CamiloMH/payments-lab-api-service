import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../../common/errors/app-error-code';
import { WebhookSignatureInvalidException } from './webhook.exceptions';

describe('WebhookSignatureInvalidException', () => {
  it('403 con code WEBHOOK_SIGNATURE_INVALID', () => {
    const exception = new WebhookSignatureInvalidException();

    expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.WebhookSignatureInvalid,
      message: 'Firma de webhook de Mercado Pago inválida',
    });
  });
});
