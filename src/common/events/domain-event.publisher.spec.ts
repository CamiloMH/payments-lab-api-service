import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  OrderEventType,
  OrderStatus,
  PaymentAttemptStatus,
  type PaymentConfirmation,
  PaymentProviderId,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';

import { DomainEventPublisher } from './domain-event.publisher';

function buildEmitter() {
  return { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
}

function buildConfirmation(overrides: Partial<PaymentConfirmation> = {}): PaymentConfirmation {
  return {
    approved: true,
    attemptStatus: PaymentAttemptStatus.Confirmed,
    externalPaymentId: 'pi_123',
    responseCode: '0',
    cardLast4: '4242',
    raw: { id: 'pi_123' },
    ...overrides,
  };
}

describe('DomainEventPublisher', () => {
  it('transition publica OrderTransitioned con emitAsync (persistente)', async () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    await pub.transition('order-1', OrderEventType.OrderPaid, {
      fromStatus: OrderStatus.PendingPayment,
      toStatus: OrderStatus.Paid,
      provider: PaymentProviderId.Stripe,
      attemptId: 'a1',
    });

    expect(emitter.emitAsync).toHaveBeenCalledWith(
      AppEvent.OrderTransitioned,
      expect.objectContaining({
        orderId: 'order-1',
        type: OrderEventType.OrderPaid,
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.Paid,
        provider: PaymentProviderId.Stripe,
        attemptId: 'a1',
      }),
    );
  });

  it('transition sin metadata rellena todos los campos opcionales con null', async () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    await pub.transition('order-1', OrderEventType.OrderCreated);

    expect(emitter.emitAsync).toHaveBeenCalledWith(
      AppEvent.OrderTransitioned,
      expect.objectContaining({
        orderId: 'order-1',
        type: OrderEventType.OrderCreated,
        fromStatus: null,
        toStatus: null,
        provider: null,
        attemptId: null,
        detail: null,
      }),
    );
  });

  it('settled publica OrderSettled con emit (best-effort)', () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    pub.settled('order-1', OrderStatus.Paid);

    expect(emitter.emit).toHaveBeenCalledWith(
      AppEvent.OrderSettled,
      expect.objectContaining({ orderId: 'order-1', status: OrderStatus.Paid }),
    );
  });

  it('tracedFromConfirmation aprobado mapea a Confirmed y captura el raw', async () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    await pub.tracedFromConfirmation(
      { orderId: 'order-1', attemptId: 'a1', provider: PaymentProviderId.Stripe },
      buildConfirmation(),
      PaymentTraceSource.Webhook,
    );

    expect(emitter.emitAsync).toHaveBeenCalledWith(
      AppEvent.PaymentTraced,
      expect.objectContaining({
        orderId: 'order-1',
        attemptId: 'a1',
        type: PaymentTraceType.Confirmed,
        source: PaymentTraceSource.Webhook,
        approved: true,
        rawPayload: { id: 'pi_123' },
      }),
    );
  });

  it('tracedFromConfirmation rechazado mapea a Rejected', async () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    await pub.tracedFromConfirmation(
      { orderId: 'order-1', attemptId: 'a1', provider: PaymentProviderId.Stripe },
      buildConfirmation({ approved: false, attemptStatus: PaymentAttemptStatus.Rejected }),
      PaymentTraceSource.Callback,
    );

    expect(emitter.emitAsync).toHaveBeenCalledWith(
      AppEvent.PaymentTraced,
      expect.objectContaining({ type: PaymentTraceType.Rejected, approved: false }),
    );
  });

  it('cardEnrolled y stockChanged publican con emit (best-effort)', () => {
    const emitter = buildEmitter();
    const pub = new DomainEventPublisher(emitter as unknown as EventEmitter2);

    pub.cardEnrolled('session-1', 'card-1', 'Visa', '4242');
    pub.stockChanged('p1', 6);

    expect(emitter.emit).toHaveBeenCalledWith(
      AppEvent.CardEnrolled,
      expect.objectContaining({
        sessionId: 'session-1',
        cardId: 'card-1',
        cardType: 'Visa',
        cardLast4: '4242',
      }),
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      AppEvent.StockChanged,
      expect.objectContaining({ productId: 'p1', available: 6 }),
    );
  });
});
