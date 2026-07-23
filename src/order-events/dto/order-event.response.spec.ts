import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';
import type { OrderEvent } from '../entities/order-event.entity';
import { OrderEventResponse } from './order-event.response';

function buildEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    id: 'event-1',
    orderId: 'order-1',
    type: OrderEventType.OrderPaid,
    fromStatus: OrderStatus.PendingPayment,
    toStatus: OrderStatus.Paid,
    provider: PaymentProviderId.TransbankWebpayPlus,
    attemptId: 'attempt-1',
    detail: 'Confirmado por Transbank',
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    ...overrides,
  } as OrderEvent;
}

describe('OrderEventResponse.from', () => {
  it('expone todos los campos del evento (son seguros por construcción)', () => {
    const response = OrderEventResponse.from(buildEvent());

    expect(response).toEqual({
      id: 'event-1',
      type: OrderEventType.OrderPaid,
      fromStatus: OrderStatus.PendingPayment,
      toStatus: OrderStatus.Paid,
      provider: PaymentProviderId.TransbankWebpayPlus,
      attemptId: 'attempt-1',
      detail: 'Confirmado por Transbank',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    });
  });

  it('oculta el orderId (redundante: el cliente ya conoce la orden por la ruta)', () => {
    const response = OrderEventResponse.from(buildEvent());

    expect(response).not.toHaveProperty('orderId');
  });

  it('expone null en los campos opcionales ausentes', () => {
    const response = OrderEventResponse.from(
      buildEvent({
        fromStatus: null,
        toStatus: null,
        provider: null,
        attemptId: null,
        detail: null,
      }),
    );

    expect(response.fromStatus).toBeNull();
    expect(response.toStatus).toBeNull();
    expect(response.provider).toBeNull();
    expect(response.attemptId).toBeNull();
    expect(response.detail).toBeNull();
  });
});
