import { HttpStatus } from '@nestjs/common';

import { AppErrorCode } from '../../common/errors/app-error-code';
import {
  CartEmptyException,
  CartItemNotFoundException,
  InvalidQuantityException,
} from './cart.exceptions';

describe('CartEmptyException', () => {
  it('400 con code CART_EMPTY', () => {
    const exception = new CartEmptyException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.CartEmpty,
      message: 'El carrito está vacío',
    });
  });
});

describe('CartItemNotFoundException', () => {
  it('404 con el productId en el mensaje', () => {
    const exception = new CartItemNotFoundException('p1');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.CartItemNotFound,
      message: 'El producto p1 no está en el carrito',
    });
  });
});

describe('InvalidQuantityException', () => {
  it('400 con code INVALID_QUANTITY', () => {
    const exception = new InvalidQuantityException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.InvalidQuantity,
      message: 'La cantidad debe ser mayor a 0',
    });
  });
});
