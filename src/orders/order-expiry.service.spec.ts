import { Logger } from '@nestjs/common';
import { OrderEventType, OrderStatus } from '@/domain';

import type { Order } from './entities/order.entity';
import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { OrderExpiryService } from './order-expiry.service';
import { OrderRepository } from './repositories/order.repository';
import type { StockReservationService } from '../stock/stock-reservation.service';

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    status: OrderStatus.PendingPayment,
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as Order;
}

describe('OrderExpiryService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildDeps(overrides: { overdue?: Order[] } = {}) {
    const orders = {
      findExpirablePendingPayment: jest.fn().mockResolvedValue(overrides.overdue ?? []),
      save: jest.fn(async (entity: unknown) => entity),
    } as unknown as OrderRepository;
    const stockReservationService = { release: jest.fn() } as unknown as StockReservationService;
    const events = { transition: jest.fn().mockResolvedValue([]) };

    const service = new OrderExpiryService(
      orders,
      stockReservationService,
      events as unknown as DomainEventPublisher,
    );
    return { service, orders, stockReservationService, events };
  }

  describe('expireOverdueOrders', () => {
    it('transiciona a Expired, libera el stock y registra el evento por cada orden vencida', async () => {
      const order = buildOrder();
      const { service, orders, stockReservationService, events } = buildDeps({ overdue: [order] });

      const count = await service.expireOverdueOrders(new Date('2026-01-01T00:10:00.000Z'));

      expect(count).toBe(1);
      expect(orders.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.Expired }),
      );
      expect(stockReservationService.release).toHaveBeenCalledWith('order-1');
      expect(events.transition).toHaveBeenCalledWith('order-1', OrderEventType.OrderExpired, {
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.Expired,
      });
    });

    it('no hace nada si no hay órdenes vencidas', async () => {
      const { service, orders, events } = buildDeps({ overdue: [] });

      const count = await service.expireOverdueOrders(new Date());

      expect(count).toBe(0);
      expect(orders.save).not.toHaveBeenCalled();
      expect(events.transition).not.toHaveBeenCalled();
    });
  });

  describe('sweep', () => {
    it('delega en expireOverdueOrders', async () => {
      const { service, orders } = buildDeps({ overdue: [] });

      await service.sweep();

      expect(orders.findExpirablePendingPayment).toHaveBeenCalledTimes(1);
    });

    it('no propaga si expireOverdueOrders falla (el cron no debe morir)', async () => {
      const orders = {
        findExpirablePendingPayment: jest.fn().mockRejectedValue(new Error('db caída')),
      } as unknown as OrderRepository;
      const service = new OrderExpiryService(
        orders,
        { release: jest.fn() } as unknown as StockReservationService,
        { transition: jest.fn().mockResolvedValue([]) } as unknown as DomainEventPublisher,
      );

      await expect(service.sweep()).resolves.toBeUndefined();
    });
  });
});
