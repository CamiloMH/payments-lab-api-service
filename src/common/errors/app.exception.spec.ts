import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from './app-error-code';
import { AppException } from './app.exception';

describe('AppException', () => {
  it('expone status HTTP, code y message vía getResponse()', () => {
    const exception = new AppException(
      HttpStatus.NOT_FOUND,
      AppErrorCode.ProductNotFound,
      'Producto x no encontrado',
    );

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.ProductNotFound,
      message: 'Producto x no encontrado',
    });
  });

  it('incluye details en el cuerpo cuando se provee', () => {
    const details = [{ productId: 'p1', requested: 3, available: 1 }];
    const exception = new AppException(
      HttpStatus.CONFLICT,
      AppErrorCode.StockInsufficient,
      'Stock insuficiente',
      details,
    );

    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.StockInsufficient,
      message: 'Stock insuficiente',
      details,
    });
  });

  it('omite details del cuerpo cuando no se provee', () => {
    const exception = new AppException(
      HttpStatus.BAD_REQUEST,
      AppErrorCode.InvalidQuantity,
      'Cantidad inválida',
    );

    expect(exception.getResponse()).not.toHaveProperty('details');
  });
});
