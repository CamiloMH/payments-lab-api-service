import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../common/errors/app-error-code';
import { InsufficientStockException } from './insufficient-stock.exception';

describe('InsufficientStockException', () => {
  it('409 con code STOCK_INSUFFICIENT y el detalle por producto', () => {
    const details = [{ productId: 'p1', requested: 3, available: 1 }];
    const exception = new InsufficientStockException(details);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.StockInsufficient,
      message: 'Stock insuficiente para uno o más productos',
      details,
    });
    expect(exception.details).toBe(details);
  });
});
