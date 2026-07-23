import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';

import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import type { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import type { PaymentTraceService } from '../payment-traces/payment-trace.service';
import type { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import type { PaymentProviderPort } from '../payments/ports/payment-provider.port';
import type { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';
import type { StockReservationService } from '../stock/stock-reservation.service';
import { Order } from './entities/order.entity';
import {
  InvalidOrderTransitionException,
  OrderNotFoundException,
  OrderNotOwnedException,
  OrderNotRefundableException,
  RefundFailedException,
} from './exceptions/order.exceptions';
import { OrderEventService } from '../order-events/order-event.service';
import { OrderRepository } from './repositories/order.repository';
import { OrdersService } from './orders.service';

function mockOrderRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findByIdWithItems: jest.fn(),
    findBySessionWithItems: jest.fn().mockResolvedValue([]),
    findBySessionPage: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    buyOrder: 'PL-order-1',
    sessionId: 'session-1',
    status: OrderStatus.PendingPayment,
    totalClp: 10000,
    expiresAt: new Date(Date.now() + 600_000),
    items: [{ productId: 'p1', quantity: 2 }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Order;
}

function buildAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
  return {
    id: 'attempt-1',
    orderId: 'order-1',
    provider: PaymentProviderId.TransbankWebpayPlus,
    ...overrides,
  } as PaymentAttempt;
}

describe('OrdersService', () => {
  function buildDeps(
    overrides: {
      orderFindOne?: jest.Mock;
      order?: Order;
      confirmedAttempt?: PaymentAttempt | null;
      providerRefund?: jest.Mock;
    } = {},
  ) {
    const order = overrides.order ?? buildOrder();
    const orders = mockOrderRepo(
      overrides.orderFindOne
        ? { findByIdWithItems: overrides.orderFindOne }
        : { findByIdWithItems: jest.fn().mockResolvedValue(order) },
    ) as unknown as OrderRepository;

    const stockReservationService = {
      release: jest.fn(),
      restoreConsumed: jest.fn(),
    } as unknown as StockReservationService;

    const orderEvents = {
      record: jest.fn(),
      listByOrder: jest.fn().mockResolvedValue([]),
    } as unknown as OrderEventService;

    const confirmedAttempt =
      overrides.confirmedAttempt === undefined ? buildAttempt() : overrides.confirmedAttempt;
    const paymentAttempts = {
      findConfirmedByOrder: jest.fn().mockResolvedValue(confirmedAttempt),
    } as unknown as PaymentAttemptRepository;

    const provider = {
      refund: overrides.providerRefund ?? jest.fn().mockResolvedValue({ succeeded: true, raw: {} }),
    } as unknown as PaymentProviderPort;
    const paymentProviderRegistry = {
      resolve: jest.fn().mockReturnValue(provider),
    } as unknown as PaymentProviderRegistry;

    const paymentTraces = {
      record: jest.fn(),
      listByOrder: jest.fn().mockResolvedValue([]),
      latestByOrders: jest.fn().mockResolvedValue(new Map()),
    } as unknown as PaymentTraceService;

    const events = {
      transition: jest.fn().mockResolvedValue([]),
      settled: jest.fn(),
      traced: jest.fn().mockResolvedValue([]),
      tracedFromConfirmation: jest.fn().mockResolvedValue([]),
      cardEnrolled: jest.fn(),
      stockChanged: jest.fn(),
    };

    const service = new OrdersService(
      orders,
      stockReservationService,
      orderEvents,
      paymentAttempts,
      paymentProviderRegistry,
      paymentTraces,
      events as unknown as DomainEventPublisher,
    );

    return {
      service,
      orders,
      stockReservationService,
      orderEvents,
      events,
      paymentAttempts,
      paymentProviderRegistry,
      paymentTraces,
      provider,
    };
  }

  describe('findById', () => {
    it('lanza NotFoundException si la orden no existe', async () => {
      const { service, orders } = buildDeps();
      (orders.findByIdWithItems as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(OrderNotFoundException);
    });

    it('retorna la orden con sus items', async () => {
      const order = buildOrder();
      const { service } = buildDeps({ order });

      await expect(service.findById('order-1')).resolves.toBe(order);
    });
  });

  describe('findBySession', () => {
    it('lista las órdenes de la sesión con sus items, más recientes primero', async () => {
      const { service, orders } = buildDeps();
      (orders.findBySessionWithItems as jest.Mock).mockResolvedValue([buildOrder()]);

      const result = await service.findBySession('session-1');

      expect(orders.findBySessionWithItems).toHaveBeenCalledWith('session-1');
      expect(result).toEqual([expect.objectContaining({ id: 'order-1' })]);
    });
  });

  describe('findBySessionPage', () => {
    it('devuelve una página de órdenes con sus metadatos de paginación', async () => {
      const { service, orders } = buildDeps();
      (orders.findBySessionPage as jest.Mock).mockResolvedValue([[buildOrder()], 30]);

      const page = await service.findBySessionPage('session-1', 3, 10);

      expect(orders.findBySessionPage).toHaveBeenCalledWith('session-1', 20, 10);
      expect(page.items).toEqual([expect.objectContaining({ id: 'order-1' })]);
      expect(page).toMatchObject({ total: 30, page: 3, pageSize: 10, totalPages: 3 });
    });
  });

  describe('latestPaymentTraces', () => {
    it('delega en el servicio de trazas la última traza por orden', async () => {
      const { service, paymentTraces } = buildDeps();
      const map = new Map([['order-1', { provider: PaymentProviderId.Stripe }]]);
      (paymentTraces.latestByOrders as jest.Mock).mockResolvedValue(map);

      const result = await service.latestPaymentTraces(['order-1']);

      expect(paymentTraces.latestByOrders).toHaveBeenCalledWith(['order-1']);
      expect(result).toBe(map);
    });
  });

  describe('cancel', () => {
    it('transiciona a Cancelled, libera el stock reservado y registra el evento', async () => {
      const order = buildOrder({ status: OrderStatus.PendingPayment });
      const { service, orders, stockReservationService, events } = buildDeps({ order });

      const cancelled = await service.cancel('order-1', 'session-1');

      expect(cancelled.status).toBe(OrderStatus.Cancelled);
      expect(orders.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.Cancelled }),
      );
      expect(stockReservationService.release).toHaveBeenCalledWith('order-1');
      expect(events.transition).toHaveBeenCalledWith('order-1', OrderEventType.OrderCancelled, {
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.Cancelled,
      });
    });

    it('rechaza cancelar una orden de otra sesión', async () => {
      const order = buildOrder({ sessionId: 'otra-sesion' });
      const { service } = buildDeps({ order });

      await expect(service.cancel('order-1', 'session-1')).rejects.toThrow(OrderNotOwnedException);
    });

    it('rechaza cancelar una orden ya Paid (transición inválida)', async () => {
      const order = buildOrder({ status: OrderStatus.Paid });
      const { service, stockReservationService, events } = buildDeps({ order });

      await expect(service.cancel('order-1', 'session-1')).rejects.toThrow(
        InvalidOrderTransitionException,
      );
      expect(stockReservationService.release).not.toHaveBeenCalled();
      expect(events.transition).not.toHaveBeenCalled();
    });

    it('rechaza cancelar una orden ya Cancelled', async () => {
      const order = buildOrder({ status: OrderStatus.Cancelled });
      const { service } = buildDeps({ order });

      await expect(service.cancel('order-1', 'session-1')).rejects.toThrow(
        InvalidOrderTransitionException,
      );
    });
  });

  describe('timeline', () => {
    it('devuelve el historial de eventos de una orden propia', async () => {
      const { service, orderEvents } = buildDeps();
      const events = [{ id: 'event-1' }];
      (orderEvents.listByOrder as jest.Mock).mockResolvedValue(events);

      const result = await service.timeline('order-1', 'session-1');

      expect(orderEvents.listByOrder).toHaveBeenCalledWith('order-1');
      expect(result).toBe(events);
    });

    it('rechaza el timeline de una orden de otra sesión', async () => {
      const order = buildOrder({ sessionId: 'otra-sesion' });
      const { service, orderEvents } = buildDeps({ order });

      await expect(service.timeline('order-1', 'session-1')).rejects.toThrow(
        OrderNotOwnedException,
      );
      expect(orderEvents.listByOrder).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('devuelve una orden Paid: llama al refund del provider, transiciona a Refunded, restaura stock y registra eventos', async () => {
      const order = buildOrder({
        status: OrderStatus.Paid,
        totalClp: 19980,
        items: [{ productId: 'p1', quantity: 2 }] as unknown as Order['items'],
      });
      const attempt = buildAttempt({ provider: PaymentProviderId.TransbankWebpayPlus });
      const {
        service,
        orders,
        stockReservationService,
        events,
        paymentProviderRegistry,
        provider,
      } = buildDeps({
        order,
        confirmedAttempt: attempt,
      });

      const refunded = await service.refund('order-1', 'session-1');

      expect(paymentProviderRegistry.resolve).toHaveBeenCalledWith(
        PaymentProviderId.TransbankWebpayPlus,
      );
      expect(provider.refund).toHaveBeenCalledWith(attempt, 19980);
      expect(refunded.status).toBe(OrderStatus.Refunded);
      expect(orders.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.Refunded }),
      );
      expect(stockReservationService.restoreConsumed).toHaveBeenCalledWith([
        { productId: 'p1', quantity: 2 },
      ]);
      expect(events.transition).toHaveBeenCalledWith(
        'order-1',
        OrderEventType.RefundRequested,
        expect.objectContaining({
          provider: PaymentProviderId.TransbankWebpayPlus,
          attemptId: 'attempt-1',
        }),
      );
      expect(events.transition).toHaveBeenCalledWith(
        'order-1',
        OrderEventType.OrderRefunded,
        expect.objectContaining({ fromStatus: OrderStatus.Paid, toStatus: OrderStatus.Refunded }),
      );
    });

    it('rechaza devolver una orden que no está Paid', async () => {
      const order = buildOrder({ status: OrderStatus.PendingPayment });
      const { service, orders, events } = buildDeps({ order });

      await expect(service.refund('order-1', 'session-1')).rejects.toThrow(
        OrderNotRefundableException,
      );
      expect(orders.save).not.toHaveBeenCalled();
      expect(events.transition).not.toHaveBeenCalled();
    });

    it('rechaza devolver una orden ya Refunded (idempotencia)', async () => {
      const order = buildOrder({ status: OrderStatus.Refunded });
      const { service } = buildDeps({ order });

      await expect(service.refund('order-1', 'session-1')).rejects.toThrow(
        OrderNotRefundableException,
      );
    });

    it('rechaza devolver una orden de otra sesión', async () => {
      const order = buildOrder({ status: OrderStatus.Paid, sessionId: 'otra-sesion' });
      const { service } = buildDeps({ order });

      await expect(service.refund('order-1', 'session-1')).rejects.toThrow(OrderNotOwnedException);
    });

    it('lanza RefundFailedException si no hay un intento Confirmed para la orden', async () => {
      const order = buildOrder({ status: OrderStatus.Paid });
      const { service, orders } = buildDeps({ order, confirmedAttempt: null });

      await expect(service.refund('order-1', 'session-1')).rejects.toThrow(RefundFailedException);
      expect(orders.save).not.toHaveBeenCalled();
    });

    it('lanza RefundFailedException si el provider rechaza el refund, sin cambiar el estado', async () => {
      const order = buildOrder({ status: OrderStatus.Paid });
      const { service, orders, stockReservationService, events } = buildDeps({
        order,
        providerRefund: jest.fn().mockResolvedValue({ succeeded: false, raw: {} }),
      });

      await expect(service.refund('order-1', 'session-1')).rejects.toThrow(RefundFailedException);
      expect(orders.save).not.toHaveBeenCalled();
      expect(stockReservationService.restoreConsumed).not.toHaveBeenCalled();
      expect(events.transition).not.toHaveBeenCalledWith(
        'order-1',
        OrderEventType.OrderRefunded,
        expect.anything(),
      );
    });
  });
});
