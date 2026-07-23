import {
  OrderEventType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProviderId,
  type PaymentConfirmation,
  PaymentTraceSource,
} from '@/domain';

import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { Order } from '../orders/entities/order.entity';
import type { OrderRepository } from '../orders/repositories/order.repository';
import type { StockReservationService } from '../stock/stock-reservation.service';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { PaymentCallbackService } from './payment-callback.service';
import type { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import type { PaymentProviderPort } from './ports/payment-provider.port';
import type { PaymentProviderRegistry } from './registry/payment-provider.registry';

/** Doble de `DomainEventPublisher`: registra las publicaciones para las aserciones. */
function mockEvents() {
  return {
    transition: jest.fn().mockResolvedValue([]),
    settled: jest.fn(),
    traced: jest.fn().mockResolvedValue([]),
    tracedFromConfirmation: jest.fn().mockResolvedValue([]),
    cardEnrolled: jest.fn(),
    stockChanged: jest.fn(),
  };
}

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findByIdOrFail: jest.fn(),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

function buildAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
  return {
    id: 'attempt-1',
    orderId: 'order-1',
    provider: PaymentProviderId.TransbankWebpayPlus,
    status: PaymentAttemptStatus.Redirected,
    externalToken: 'tok-1',
    externalPaymentId: null,
    responseCode: null,
    cardLast4: null,
    rawResponse: null,
    ...overrides,
  } as PaymentAttempt;
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    status: OrderStatus.PendingPayment,
    totalClp: 1000,
    items: [{ productId: 'p1', quantity: 1 }],
    ...overrides,
  } as unknown as Order;
}

function buildConfirmation(overrides: Partial<PaymentConfirmation> = {}): PaymentConfirmation {
  return {
    approved: true,
    attemptStatus: PaymentAttemptStatus.Confirmed,
    externalPaymentId: 'auth-1',
    responseCode: '0',
    cardLast4: '1234',
    raw: {},
    ...overrides,
  };
}

describe('PaymentCallbackService', () => {
  function buildDeps(overrides: { order?: Order } = {}) {
    const order = overrides.order ?? buildOrder();
    const orders = mockRepo({
      findByIdOrFail: jest.fn().mockResolvedValue(order),
    }) as unknown as OrderRepository;
    const paymentAttempts = mockRepo() as unknown as PaymentAttemptRepository;
    const stockReservationService = {
      consume: jest.fn(),
      reserveAtomic: jest.fn(),
    } as unknown as StockReservationService;
    const registry = { resolve: jest.fn() } as unknown as PaymentProviderRegistry;
    const events = mockEvents();

    const service = new PaymentCallbackService(
      paymentAttempts,
      orders,
      stockReservationService,
      registry,
      events as unknown as DomainEventPublisher,
    );
    return {
      service,
      orders,
      paymentAttempts,
      stockReservationService,
      events,
      registry,
      order,
    };
  }

  it('aprueba: transiciona la orden PendingPayment a Paid y consume el stock', async () => {
    const { service, orders, stockReservationService, events } = buildDeps();

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: true }),
      PaymentTraceSource.Callback,
    );

    expect(order.status).toBe(OrderStatus.Paid);
    expect(events.settled).toHaveBeenCalledWith('order-1', OrderStatus.Paid);
    expect(orders.save).toHaveBeenCalledWith(expect.objectContaining({ status: OrderStatus.Paid }));
    expect(stockReservationService.consume).toHaveBeenCalledWith('order-1');
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentConfirmed,
      expect.objectContaining({ attemptId: 'attempt-1' }),
    );
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.OrderPaid,
      expect.objectContaining({
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.Paid,
      }),
    );
  });

  it('rechazada: transiciona PendingPayment a PaymentFailed sin tocar el stock', async () => {
    const { service, orders, stockReservationService, events } = buildDeps();

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: false, attemptStatus: PaymentAttemptStatus.Rejected }),
      PaymentTraceSource.Callback,
    );

    expect(order.status).toBe(OrderStatus.PaymentFailed);
    expect(events.settled).toHaveBeenCalledWith('order-1', OrderStatus.PaymentFailed);
    expect(orders.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.PaymentFailed }),
    );
    expect(stockReservationService.consume).not.toHaveBeenCalled();
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentRejected,
      expect.objectContaining({ attemptId: 'attempt-1' }),
    );
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentFailed,
      expect.objectContaining({
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.PaymentFailed,
      }),
    );
  });

  it('idempotente: si el intento ya estaba Confirmed, no reprocesa (evita doble consumo y doble evento)', async () => {
    const { service, orders, stockReservationService, events } = buildDeps({
      order: buildOrder({ status: OrderStatus.Paid }),
    });

    const order = await service.applyConfirmation(
      buildAttempt({ status: PaymentAttemptStatus.Confirmed }),
      buildConfirmation({ approved: true }),
      PaymentTraceSource.Callback,
    );

    expect(order.status).toBe(OrderStatus.Paid);
    expect(orders.save).not.toHaveBeenCalled();
    expect(stockReservationService.consume).not.toHaveBeenCalled();
    expect(events.transition).not.toHaveBeenCalled();
  });

  it('aprobación sobre una orden que ya estaba Paid es idempotente (no vuelve a guardar ni consumir ni emitir OrderPaid)', async () => {
    const { service, orders, stockReservationService, events } = buildDeps({
      order: buildOrder({ status: OrderStatus.Paid }),
    });

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: true }),
      PaymentTraceSource.Callback,
    );

    expect(order.status).toBe(OrderStatus.Paid);
    expect(orders.save).not.toHaveBeenCalled();
    expect(stockReservationService.consume).not.toHaveBeenCalled();
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentConfirmed,
      expect.anything(),
    );
    expect(events.transition).not.toHaveBeenCalledWith(
      'order-1',
      OrderEventType.OrderPaid,
      expect.anything(),
    );
  });

  it('un rechazo sobre una orden ya Cancelled/Expired no la modifica ni emite PaymentFailed (las reservas ya se liberaron)', async () => {
    const { service, orders, events } = buildDeps({
      order: buildOrder({ status: OrderStatus.Cancelled }),
    });

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: false, attemptStatus: PaymentAttemptStatus.Rejected }),
      PaymentTraceSource.Callback,
    );

    expect(order.status).toBe(OrderStatus.Cancelled);
    expect(orders.save).not.toHaveBeenCalled();
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentRejected,
      expect.anything(),
    );
    expect(events.transition).not.toHaveBeenCalledWith(
      'order-1',
      OrderEventType.PaymentFailed,
      expect.anything(),
    );
  });

  it('pago aprobado sobre orden Expired con stock disponible: re-reserva y paga', async () => {
    const { service, orders, stockReservationService, events } = buildDeps({
      order: buildOrder({ status: OrderStatus.Expired }),
    });
    (stockReservationService.reserveAtomic as jest.Mock).mockResolvedValue([]);

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: true }),
      PaymentTraceSource.Callback,
    );

    expect(stockReservationService.reserveAtomic).toHaveBeenCalledWith('order-1', [
      { productId: 'p1', quantity: 1 },
    ]);
    expect(order.status).toBe(OrderStatus.Paid);
    expect(orders.save).toHaveBeenCalledWith(expect.objectContaining({ status: OrderStatus.Paid }));
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.OrderPaid,
      expect.objectContaining({ fromStatus: OrderStatus.Expired, toStatus: OrderStatus.Paid }),
    );
  });

  it('pago aprobado sobre orden Expired sin stock disponible: reembolsa y marca Refunded', async () => {
    const { service, orders, stockReservationService, registry, events } = buildDeps({
      order: buildOrder({ status: OrderStatus.Expired }),
    });
    (stockReservationService.reserveAtomic as jest.Mock).mockRejectedValue(new Error('sin stock'));
    const provider = {
      refund: jest.fn().mockResolvedValue({ succeeded: true, raw: {} }),
    } as unknown as PaymentProviderPort;
    (registry.resolve as jest.Mock).mockReturnValue(provider);

    const order = await service.applyConfirmation(
      buildAttempt(),
      buildConfirmation({ approved: true }),
      PaymentTraceSource.Callback,
    );

    expect(provider.refund).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'attempt-1' }),
      1000,
    );
    expect(order.status).toBe(OrderStatus.Refunded);
    expect(events.settled).toHaveBeenCalledWith('order-1', OrderStatus.Refunded);
    expect(orders.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.Refunded }),
    );
    expect(events.transition).toHaveBeenCalledWith(
      'order-1',
      OrderEventType.OrderRefunded,
      expect.objectContaining({ fromStatus: OrderStatus.Expired, toStatus: OrderStatus.Refunded }),
    );
  });
});
