import { HttpStatus } from '@nestjs/common';
import { OrderStatus } from '@/domain';

import { AppErrorCode } from '../../common/errors/app-error-code';
import {
  InvalidOrderTransitionException,
  OrderNotFoundException,
  OrderNotOwnedException,
  OrderNotRefundableException,
  RefundFailedException,
} from './order.exceptions';

describe('OrderNotFoundException', () => {
  it('404 con el orderId en el mensaje', () => {
    const exception = new OrderNotFoundException('order-1');

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.OrderNotFound,
      message: 'Orden order-1 no encontrada',
    });
  });
});

describe('OrderNotOwnedException', () => {
  it('403 con code ORDER_NOT_OWNED', () => {
    const exception = new OrderNotOwnedException();

    expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.OrderNotOwned,
      message: 'Esta orden no pertenece a tu sesión',
    });
  });
});

describe('InvalidOrderTransitionException', () => {
  it('409 con el from/to en el mensaje', () => {
    const exception = new InvalidOrderTransitionException(OrderStatus.Paid, OrderStatus.Cancelled);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.InvalidOrderTransition,
      message: 'Transición de orden inválida: paid -> cancelled',
    });
  });
});

describe('OrderNotRefundableException', () => {
  it('409 con el status actual en el mensaje', () => {
    const exception = new OrderNotRefundableException(OrderStatus.PendingPayment);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.OrderNotRefundable,
      message: 'Solo se puede devolver una orden pagada (estado actual: pending_payment)',
    });
  });
});

describe('RefundFailedException', () => {
  it('502 sin detalle', () => {
    const exception = new RefundFailedException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.RefundFailed,
      message: 'El proveedor de pago rechazó la solicitud de devolución',
    });
  });
});
