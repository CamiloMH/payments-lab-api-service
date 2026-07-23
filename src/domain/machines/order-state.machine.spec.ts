import { OrderStatus } from '../enums/order-status.enum';
import {
  assertOrderTransition,
  canTransitionOrder,
  InvalidOrderTransitionError,
} from './order-state.machine';

describe('order-state.machine', () => {
  describe('transiciones válidas', () => {
    it.each([
      [OrderStatus.PendingPayment, OrderStatus.Paid],
      [OrderStatus.PendingPayment, OrderStatus.PaymentFailed],
      [OrderStatus.PendingPayment, OrderStatus.Expired],
      [OrderStatus.PendingPayment, OrderStatus.Cancelled],
      [OrderStatus.PaymentFailed, OrderStatus.PendingPayment],
      [OrderStatus.PaymentFailed, OrderStatus.Expired],
      [OrderStatus.PaymentFailed, OrderStatus.Cancelled],
      [OrderStatus.Expired, OrderStatus.Paid],
      [OrderStatus.Expired, OrderStatus.Refunded],
    ])('permite %s -> %s', (from, to) => {
      expect(() => assertOrderTransition(from, to)).not.toThrow();
      expect(canTransitionOrder(from, to)).toBe(true);
    });
  });

  describe('transiciones inválidas', () => {
    it.each([
      [OrderStatus.PendingPayment, OrderStatus.Refunded],
      [OrderStatus.PaymentFailed, OrderStatus.Refunded],
      [OrderStatus.Expired, OrderStatus.PaymentFailed],
      [OrderStatus.Expired, OrderStatus.Cancelled],
      [OrderStatus.Paid, OrderStatus.PendingPayment],
      [OrderStatus.Paid, OrderStatus.Refunded],
      [OrderStatus.Cancelled, OrderStatus.PendingPayment],
      [OrderStatus.Refunded, OrderStatus.Paid],
    ])('rechaza %s -> %s', (from, to) => {
      expect(() => assertOrderTransition(from, to)).toThrow(InvalidOrderTransitionError);
      expect(canTransitionOrder(from, to)).toBe(false);
    });

    it('el error indica el estado de origen y destino', () => {
      try {
        assertOrderTransition(OrderStatus.Paid, OrderStatus.Cancelled);
        throw new Error('debía lanzar');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidOrderTransitionError);
        const typed = error as InvalidOrderTransitionError;
        expect(typed.from).toBe(OrderStatus.Paid);
        expect(typed.to).toBe(OrderStatus.Cancelled);
        expect(typed.message).toContain(OrderStatus.Paid);
        expect(typed.message).toContain(OrderStatus.Cancelled);
      }
    });
  });

  describe('estados terminales', () => {
    it.each([OrderStatus.Paid, OrderStatus.Cancelled, OrderStatus.Refunded])(
      '%s no tiene transiciones salientes',
      (terminal) => {
        for (const to of Object.values(OrderStatus)) {
          expect(canTransitionOrder(terminal, to)).toBe(false);
        }
      },
    );
  });
});
