import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../errors/app-error-code';
import { TooManyRequestsException } from './too-many-requests.exception';

describe('TooManyRequestsException', () => {
  it('429 con code TOO_MANY_REQUESTS y mensaje en español', () => {
    const exception = new TooManyRequestsException();

    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.TooManyRequests,
      message: 'Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.',
    });
  });
});
