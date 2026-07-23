import { OrderStatus, PaymentAttemptStatus, RedirectKind } from '@/domain';
import type { Order } from '../../orders/entities/order.entity';
import type { CheckoutResult } from '../checkout.service';
import { CheckoutResultResponse } from './checkout-result.response';

describe('CheckoutResultResponse.from', () => {
  it('mapea order e initiation a su forma pública, ocultando campos sensibles anidados', () => {
    const result: CheckoutResult = {
      order: {
        id: 'order-1',
        buyOrder: 'PL-order-1',
        sessionId: 'session-1',
        status: OrderStatus.PendingPayment,
        totalClp: 19980,
        expiresAt: new Date('2026-01-01T12:00:00.000Z'),
        createdAt: new Date('2025-12-31T12:00:00.000Z'),
        items: [],
      } as unknown as Order,
      initiation: { kind: RedirectKind.Url, url: 'https://mercadopago.com/pref-1' },
    };

    const response = CheckoutResultResponse.from(result);

    expect(response).toEqual({
      order: {
        id: 'order-1',
        status: OrderStatus.PendingPayment,
        totalClp: 19980,
        expiresAt: new Date('2026-01-01T12:00:00.000Z'),
        createdAt: new Date('2025-12-31T12:00:00.000Z'),
        items: [],
      },
      initiation: { kind: RedirectKind.Url, url: 'https://mercadopago.com/pref-1' },
    });
    expect(response.order).not.toHaveProperty('buyOrder');
    expect(response.order).not.toHaveProperty('sessionId');
  });

  it('oculta confirmation en initiation cuando kind es none', () => {
    const result: CheckoutResult = {
      order: { id: 'order-1', status: OrderStatus.Paid } as unknown as Order,
      initiation: {
        kind: RedirectKind.None,
        confirmation: {
          approved: true,
          attemptStatus: PaymentAttemptStatus.Confirmed,
          externalPaymentId: 'ext-1',
          responseCode: '0',
          cardLast4: '6623',
          raw: { secreto: 'no-debe-salir' },
        },
      },
    };

    const response = CheckoutResultResponse.from(result);

    expect(response.initiation).toEqual({ kind: RedirectKind.None });
  });
});
