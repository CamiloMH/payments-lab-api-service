import { OrderStatus, PaymentProviderId } from '@/domain';
import type { PaymentTrace } from '../../payment-traces/entities/payment-trace.entity';
import type { Order } from '../entities/order.entity';
import { OrderResponse } from './order.response';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: '482910556378',
    buyOrder: 'PL-order-1',
    sessionId: 'session-1',
    status: OrderStatus.Paid,
    totalClp: 19980,
    expiresAt: new Date('2026-01-01T12:00:00.000Z'),
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        productName: 'Mouse óptico inalámbrico',
        unitPriceClp: 9990,
        quantity: 2,
      },
    ],
    createdAt: new Date('2025-12-31T12:00:00.000Z'),
    updatedAt: new Date('2025-12-31T12:05:00.000Z'),
    ...overrides,
  } as unknown as Order;
}

describe('OrderResponse.from', () => {
  it('expone id, status, totalClp, expiresAt, createdAt, items y método de pago null sin traza', () => {
    const response = OrderResponse.from(buildOrder());

    expect(response).toEqual({
      id: 'order-1',
      orderNumber: '482910556378',
      status: OrderStatus.Paid,
      totalClp: 19980,
      expiresAt: new Date('2026-01-01T12:00:00.000Z'),
      createdAt: new Date('2025-12-31T12:00:00.000Z'),
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          productName: 'Mouse óptico inalámbrico',
          unitPriceClp: 9990,
          quantity: 2,
          imageUrl: null,
        },
      ],
      paymentMethod: null,
      cardLast4: null,
    });
  });

  it('deriva paymentMethod y cardLast4 de la última traza cuando se provee', () => {
    const trace = {
      provider: PaymentProviderId.Stripe,
      cardLast4: '4242',
    } as PaymentTrace;

    const response = OrderResponse.from(buildOrder(), trace);

    expect(response.paymentMethod).toBe(PaymentProviderId.Stripe);
    expect(response.cardLast4).toBe('4242');
  });

  it('cada item expuesto oculta el orderId interno (mapeo anidado vía OrderItemResponse)', () => {
    const response = OrderResponse.from(buildOrder());

    expect(response.items[0]).not.toHaveProperty('orderId');
  });

  it('no filtra buyOrder ni sessionId (identificadores internos)', () => {
    const response = OrderResponse.from(buildOrder());

    expect(response).not.toHaveProperty('buyOrder');
    expect(response).not.toHaveProperty('sessionId');
    expect(response).not.toHaveProperty('updatedAt');
  });
});
