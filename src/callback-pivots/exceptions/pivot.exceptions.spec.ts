import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../../common/errors/app-error-code';
import {
  PivotAlreadyConsumedException,
  PivotExpiredException,
  PivotNotFoundException,
} from './pivot.exceptions';

describe('PivotNotFoundException', () => {
  it('404 con el pivotId en el mensaje', () => {
    const exception = new PivotNotFoundException('pivot-1');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.PivotNotFound,
      message: 'Pivot pivot-1 no encontrado',
    });
  });
});

describe('PivotAlreadyConsumedException', () => {
  it('410 con code PIVOT_ALREADY_CONSUMED', () => {
    const exception = new PivotAlreadyConsumedException();

    expect(exception.getStatus()).toBe(HttpStatus.GONE);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.PivotAlreadyConsumed,
      message: 'Este pivot ya fue consumido',
    });
  });
});

describe('PivotExpiredException', () => {
  it('410 con code PIVOT_EXPIRED', () => {
    const exception = new PivotExpiredException();

    expect(exception.getStatus()).toBe(HttpStatus.GONE);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.PivotExpired,
      message: 'Este pivot expiró',
    });
  });
});
