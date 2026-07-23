import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderEventType, OrderStatus } from '@/domain';

import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { StockReservationService } from '../stock/stock-reservation.service';
import { OrderRepository } from './repositories/order.repository';

/**
 * Cierra el estado `pending_payment` de las órdenes cuya reserva ya venció y
 * nadie completó el pago: las transiciona a `Expired`, libera el stock (si el
 * sweep de `StockReservationService` no lo hizo ya, es idempotente) y
 * registra el evento. Sin este barrido, `OrderStatus.Expired` nunca se
 * aplicaba pese a estar contemplado en la máquina de estados.
 */
@Injectable()
export class OrderExpiryService {
  private readonly logger = new Logger(OrderExpiryService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly stockReservationService: StockReservationService,
    private readonly events: DomainEventPublisher,
  ) {}

  @Cron('*/30 * * * * *')
  async sweep(): Promise<void> {
    try {
      const expiredCount = await this.expireOverdueOrders(new Date());
      if (expiredCount > 0) {
        this.logger.debug(`Expiradas ${expiredCount} orden(es) pending_payment vencida(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Fallo el sweep de expiración de órdenes',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /** Extraído del cron para ser testeable con un `now` determinista. */
  async expireOverdueOrders(now: Date): Promise<number> {
    const overdue = await this.orders.findExpirablePendingPayment(now);

    for (const order of overdue) {
      const fromStatus = order.status;
      order.status = OrderStatus.Expired;
      await this.orders.save(order);
      await this.stockReservationService.release(order.id);
      await this.events.transition(order.id, OrderEventType.OrderExpired, {
        fromStatus,
        toStatus: OrderStatus.Expired,
      });
    }

    return overdue.length;
  }
}
