import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';
import { OrderEvent } from './order-event.entity';

describe('OrderEvent', () => {
  it('assignId genera un nanoid si no tiene id', () => {
    const event = new OrderEvent();
    event.orderId = 'order-1';
    event.type = OrderEventType.OrderCreated;

    event.assignId();

    expect(event.id).toHaveLength(21);
  });

  it('assignId no sobrescribe un id ya asignado', () => {
    const event = new OrderEvent();
    event.id = 'existing-id';

    event.assignId();

    expect(event.id).toBe('existing-id');
  });

  it('acepta los campos opcionales del evento', () => {
    const event = new OrderEvent();
    event.orderId = 'order-1';
    event.type = OrderEventType.OrderPaid;
    event.fromStatus = OrderStatus.PendingPayment;
    event.toStatus = OrderStatus.Paid;
    event.provider = PaymentProviderId.TransbankWebpayPlus;
    event.attemptId = 'attempt-1';
    event.detail = 'Confirmado por Transbank';

    expect(event.fromStatus).toBe(OrderStatus.PendingPayment);
    expect(event.toStatus).toBe(OrderStatus.Paid);
    expect(event.provider).toBe(PaymentProviderId.TransbankWebpayPlus);
    expect(event.attemptId).toBe('attempt-1');
    expect(event.detail).toBe('Confirmado por Transbank');
  });
});
