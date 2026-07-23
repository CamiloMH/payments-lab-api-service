import { Injectable, Logger } from '@nestjs/common';
import {
  OrderEventType,
  OrderStatus,
  PaymentAttemptStatus,
  type PaymentConfirmation,
  PaymentTracedEvent,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';

import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { formatLogFields } from '../common/logging/format-log-fields';
import { Order } from '../orders/entities/order.entity';
import { OrderRepository } from '../orders/repositories/order.repository';
import { StockReservationService } from '../stock/stock-reservation.service';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import { PaymentProviderRegistry } from './registry/payment-provider.registry';

const RESOLVED_ATTEMPT_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  PaymentAttemptStatus.Confirmed,
  PaymentAttemptStatus.Rejected,
  PaymentAttemptStatus.Aborted,
  PaymentAttemptStatus.Error,
]);

/**
 * Aplica el resultado de un `PaymentConfirmation` (venga de un callback
 * redirect, un webhook o una verificación activa) a la orden asociada.
 * Compartido por todos los adaptadores de pago para no duplicar la máquina
 * de estados ni el manejo del caso "pago tardío sobre reserva expirada".
 *
 * No conoce a sus consumidores: publica eventos de dominio vía
 * `DomainEventPublisher` y son los listeners (audit log, trazas, WebSocket) los
 * que reaccionan.
 */
@Injectable()
export class PaymentCallbackService {
  private readonly logger = new Logger(PaymentCallbackService.name);

  constructor(
    private readonly paymentAttempts: PaymentAttemptRepository,
    private readonly orders: OrderRepository,
    private readonly stockReservationService: StockReservationService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly events: DomainEventPublisher,
  ) {}

  /**
   * @param source Canal por el que llegó la confirmación (callback redirect,
   *   webhook o verificación), para registrarlo en la traza del pago.
   */
  async applyConfirmation(
    attempt: PaymentAttempt,
    confirmation: PaymentConfirmation,
    source: PaymentTraceSource,
  ): Promise<Order> {
    // Idempotencia: un attempt ya resuelto no se reprocesa (webhook duplicado, doble callback, etc.).
    if (RESOLVED_ATTEMPT_STATUSES.has(attempt.status)) {
      this.logger.debug(formatLogFields({ attemptId: attempt.id, status: attempt.status }));
      return this.orders.findByIdOrFail(attempt.orderId);
    }

    this.logger.log(
      formatLogFields({
        attemptId: attempt.id,
        provider: attempt.provider,
        aprobado: confirmation.approved,
      }),
    );

    attempt.status = confirmation.attemptStatus;
    attempt.externalPaymentId = confirmation.externalPaymentId;
    attempt.responseCode = confirmation.responseCode;
    attempt.cardLast4 = confirmation.cardLast4;
    attempt.rawResponse = confirmation.raw;

    // Guardar el attempt y buscar la orden no dependen entre sí.
    const [, order] = await Promise.all([
      this.paymentAttempts.save(attempt),
      this.orders.findByIdOrFail(attempt.orderId),
    ]);

    // Bitácora de trazabilidad: captura la respuesta cruda del PSP y el canal.
    await this.events.tracedFromConfirmation(
      { orderId: attempt.orderId, attemptId: attempt.id, provider: attempt.provider },
      confirmation,
      source,
    );

    await this.events.transition(
      order.id,
      confirmation.approved ? OrderEventType.PaymentConfirmed : OrderEventType.PaymentRejected,
      { provider: attempt.provider, attemptId: attempt.id },
    );

    if (confirmation.approved) {
      return this.applyApproved(order, attempt);
    }
    return this.applyRejected(order, attempt);
  }

  private async applyApproved(order: Order, attempt: PaymentAttempt): Promise<Order> {
    if (order.status === OrderStatus.Paid) {
      this.logger.debug(formatLogFields({ orderId: order.id }));
      return order; // idempotente
    }

    if (order.status === OrderStatus.Expired) {
      return this.reReserveOrRefund(order, attempt);
    }

    const fromStatus = order.status;
    order.status = OrderStatus.Paid;
    const saved = await this.orders.save(order);
    await this.stockReservationService.consume(order.id);
    await this.events.transition(order.id, OrderEventType.OrderPaid, {
      fromStatus,
      toStatus: OrderStatus.Paid,
      provider: attempt.provider,
      attemptId: attempt.id,
    });
    this.logger.log(formatLogFields({ orderId: order.id, provider: attempt.provider }));
    this.events.settled(saved.id, saved.status);
    return saved;
  }

  private async applyRejected(order: Order, attempt: PaymentAttempt): Promise<Order> {
    if (order.status === OrderStatus.PendingPayment || order.status === OrderStatus.PaymentFailed) {
      const fromStatus = order.status;
      order.status = OrderStatus.PaymentFailed;
      const saved = await this.orders.save(order);
      await this.events.transition(order.id, OrderEventType.PaymentFailed, {
        fromStatus,
        toStatus: OrderStatus.PaymentFailed,
        provider: attempt.provider,
        attemptId: attempt.id,
      });
      this.logger.warn(formatLogFields({ orderId: order.id, provider: attempt.provider }));
      this.events.settled(saved.id, saved.status);
      return saved;
    }
    // Expirada/cancelada: las reservas ya se liberaron, no hay nada más que hacer.
    return order;
  }

  /**
   * Un pago llegó aprobado después de que la reserva expiró. Si el stock
   * sigue disponible, se re-reserva y la orden se paga igual; si no, se
   * reembolsa automáticamente vía el proveedor y la orden queda Refunded.
   */
  private async reReserveOrRefund(order: Order, attempt: PaymentAttempt): Promise<Order> {
    try {
      await this.stockReservationService.reserveAtomic(
        order.id,
        order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
      order.status = OrderStatus.Paid;
      const saved = await this.orders.save(order);
      await this.events.transition(order.id, OrderEventType.OrderPaid, {
        fromStatus: OrderStatus.Expired,
        toStatus: OrderStatus.Paid,
        provider: attempt.provider,
        attemptId: attempt.id,
      });
      this.logger.log(formatLogFields({ orderId: order.id }));
      this.events.settled(saved.id, saved.status);
      return saved;
    } catch {
      const provider = this.paymentProviderRegistry.resolve(attempt.provider);
      const refund = await provider.refund(attempt, order.totalClp);
      await this.events.traced(
        new PaymentTracedEvent(
          order.id,
          attempt.provider,
          refund.succeeded ? PaymentTraceType.Refunded : PaymentTraceType.RefundFailed,
          PaymentTraceSource.Refund,
          attempt.id,
          refund.succeeded,
          null,
          null,
          null,
          null,
          refund.raw,
        ),
      );
      order.status = OrderStatus.Refunded;
      const saved = await this.orders.save(order);
      await this.events.transition(order.id, OrderEventType.OrderRefunded, {
        fromStatus: OrderStatus.Expired,
        toStatus: OrderStatus.Refunded,
        provider: attempt.provider,
        attemptId: attempt.id,
        detail:
          'Reembolso automático: el pago llegó tras expirar la reserva y no había stock disponible',
      });
      this.logger.warn(formatLogFields({ orderId: order.id, provider: attempt.provider }));
      this.events.settled(saved.id, saved.status);
      return saved;
    }
  }
}
