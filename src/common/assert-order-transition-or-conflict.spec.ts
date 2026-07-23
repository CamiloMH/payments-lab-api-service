import { assertOrderTransition, OrderStatus } from '@/domain';

import { InvalidOrderTransitionException } from '../orders/exceptions/order.exceptions';
import { assertOrderTransitionOrConflict } from './assert-order-transition-or-conflict';

jest.mock('@/domain', () => {
  const actual = jest.requireActual('@/domain');
  return { ...actual, assertOrderTransition: jest.fn(actual.assertOrderTransition) };
});

describe('assertOrderTransitionOrConflict', () => {
  afterEach(() => {
    jest
      .mocked(assertOrderTransition)
      .mockImplementation(
        jest.requireActual<typeof import('@/domain')>('@/domain').assertOrderTransition,
      );
  });

  it('no lanza si la transición es válida', () => {
    expect(() =>
      assertOrderTransitionOrConflict(OrderStatus.PendingPayment, OrderStatus.Cancelled),
    ).not.toThrow();
  });

  it('traduce una transición inválida a InvalidOrderTransitionException (409)', () => {
    expect(() => assertOrderTransitionOrConflict(OrderStatus.Paid, OrderStatus.Cancelled)).toThrow(
      InvalidOrderTransitionException,
    );
  });

  it('repropaga sin traducir cualquier error que no sea InvalidOrderTransitionError', () => {
    const unexpected = new Error('fallo inesperado del dominio');
    jest.mocked(assertOrderTransition).mockImplementationOnce(() => {
      throw unexpected;
    });

    expect(() => assertOrderTransitionOrConflict(OrderStatus.Paid, OrderStatus.Cancelled)).toThrow(
      unexpected,
    );
  });
});
