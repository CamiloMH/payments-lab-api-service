import { OrderEventType, OrderStatus, OrderTransitionedEvent, PaymentProviderId } from '@/domain';

import type { OrderEventService } from '../order-event.service';
import { OrderAuditListener } from './order-audit.listener';

describe('OrderAuditListener', () => {
  it('registra el evento de audit log mapeando los nulls a undefined', async () => {
    const orderEvents = { record: jest.fn() } as unknown as OrderEventService;
    const listener = new OrderAuditListener(orderEvents);

    await listener.handle(
      new OrderTransitionedEvent(
        'order-1',
        OrderEventType.OrderPaid,
        OrderStatus.PendingPayment,
        OrderStatus.Paid,
        PaymentProviderId.Stripe,
        'attempt-1',
      ),
    );

    expect(orderEvents.record).toHaveBeenCalledWith('order-1', OrderEventType.OrderPaid, {
      fromStatus: OrderStatus.PendingPayment,
      toStatus: OrderStatus.Paid,
      provider: PaymentProviderId.Stripe,
      attemptId: 'attempt-1',
      detail: undefined,
    });
  });

  it('registra un evento sin metadata (todos los campos undefined)', async () => {
    const orderEvents = { record: jest.fn() } as unknown as OrderEventService;
    const listener = new OrderAuditListener(orderEvents);

    await listener.handle(new OrderTransitionedEvent('order-1', OrderEventType.OrderCreated));

    expect(orderEvents.record).toHaveBeenCalledWith('order-1', OrderEventType.OrderCreated, {
      fromStatus: undefined,
      toStatus: undefined,
      provider: undefined,
      attemptId: undefined,
      detail: undefined,
    });
  });
});
