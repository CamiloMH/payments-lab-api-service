import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../../common/errors/app-error-code';
import { ProductNotFoundException } from './product.exceptions';

describe('ProductNotFoundException', () => {
  it('404 con mensaje singular para un solo id', () => {
    const exception = new ProductNotFoundException('p1');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.ProductNotFound,
      message: 'Producto p1 no encontrado',
    });
  });

  it('404 con mensaje plural para varios ids', () => {
    const exception = new ProductNotFoundException(['p1', 'p2']);

    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.ProductNotFound,
      message: 'Productos no encontrados: p1, p2',
    });
  });
});
