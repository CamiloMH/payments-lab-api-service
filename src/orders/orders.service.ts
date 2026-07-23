import { Injectable, Logger } from '@nestjs/common';
import {
  OrderEventType,
  OrderStatus,
  PaymentTracedEvent,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';

import { assertOrderTransitionOrConflict } from '../common/assert-order-transition-or-conflict';
import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { buildPage, pageOffset, type Page } from '../common/pagination/page';
import { formatLogFields } from '../common/logging/format-log-fields';
import { PaymentTrace } from '../payment-traces/entities/payment-trace.entity';
import { PaymentTraceService } from '../payment-traces/payment-trace.service';
import { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';
import { StockReservationService } from '../stock/stock-reservation.service';
import { OrderEvent } from '../order-events/entities/order-event.entity';
import { Order } from './entities/order.entity';
import {
  OrderNotFoundException,
  OrderNotOwnedException,
  OrderNotRefundableException,
  RefundFailedException,
} from './exceptions/order.exceptions';
import { OrderEventService } from '../order-events/order-event.service';
import { OrderRepository } from './repositories/order.repository';

/**
 * CRUD y transiciones de orden. Toda mutación de `status` pasa por
 * `assertOrderTransition` (única fuente de verdad de la máquina de estados),
 * aplica el efecto colateral correspondiente sobre las reservas de stock, y
 * registra el evento resultante en el audit log (`OrderEventService`).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly stockReservationService: StockReservationService,
    private readonly orderEvents: OrderEventService,
    private readonly paymentAttempts: PaymentAttemptRepository,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly paymentTraces: PaymentTraceService,
    private readonly events: DomainEventPublisher,
  ) {}

  async findById(orderId: string): Promise<Order> {
    const order = await this.orders.findByIdWithItems(orderId);
    if (!order) {
      throw new OrderNotFoundException(orderId);
    }
    return order;
  }

  async findBySession(sessionId: string): Promise<Order[]> {
    return this.orders.findBySessionWithItems(sessionId);
  }

  /** Una página de órdenes propias, más recientes primero. */
  async findBySessionPage(sessionId: string, page: number, pageSize: number): Promise<Page<Order>> {
    const [orders, total] = await this.orders.findBySessionPage(
      sessionId,
      pageOffset(page, pageSize),
      pageSize,
    );
    return buildPage(orders, total, page, pageSize);
  }

  /** Cancela una orden propia y libera su stock reservado. */
  async cancel(orderId: string, sessionId: string): Promise<Order> {
    this.logger.log(formatLogFields({ orderId }));
    const order = await this.findOwned(orderId, sessionId);
    const fromStatus = order.status;
    assertOrderTransitionOrConflict(order.status, OrderStatus.Cancelled);

    order.status = OrderStatus.Cancelled;
    const saved = await this.orders.save(order);
    await this.stockReservationService.release(orderId);
    await this.events.transition(orderId, OrderEventType.OrderCancelled, {
      fromStatus,
      toStatus: OrderStatus.Cancelled,
    });
    return saved;
  }

  /** Busca una orden y valida que pertenezca a la sesión, para no filtrar órdenes ajenas (IDOR). */
  async findOwned(orderId: string, sessionId: string): Promise<Order> {
    const order = await this.findById(orderId);
    if (order.sessionId !== sessionId) {
      throw new OrderNotOwnedException();
    }
    return order;
  }

  /** Timeline (audit log) de una orden propia, del evento más antiguo al más reciente. */
  async timeline(orderId: string, sessionId: string): Promise<OrderEvent[]> {
    await this.findOwned(orderId, sessionId);
    return this.orderEvents.listByOrder(orderId);
  }

  /** Bitácora de trazabilidad de pagos de una orden propia (campos seguros; sin `rawPayload`). */
  async paymentTraceLog(orderId: string, sessionId: string): Promise<PaymentTrace[]> {
    await this.findOwned(orderId, sessionId);
    return this.paymentTraces.listByOrder(orderId);
  }

  /** Última traza de pago de cada orden (para resolver el método de pago sin N+1 al listar). */
  latestPaymentTraces(orderIds: string[]): Promise<Map<string, PaymentTrace>> {
    return this.paymentTraces.latestByOrders(orderIds);
  }

  /**
   * Devuelve una orden propia `paid`: reembolsa contra el proveedor que la
   * cobró, transiciona a `refunded` y restaura el stock consumido. `refunded`
   * es terminal; un segundo intento sobre la misma orden es rechazado
   * (idempotencia). Si el proveedor rechaza el reembolso, la orden no cambia.
   */
  async refund(orderId: string, sessionId: string): Promise<Order> {
    this.logger.log(formatLogFields({ orderId }));
    const order = await this.findOwned(orderId, sessionId);
    if (order.status !== OrderStatus.Paid) {
      throw new OrderNotRefundableException(order.status);
    }

    const attempt = await this.paymentAttempts.findConfirmedByOrder(orderId);
    if (!attempt) {
      throw new RefundFailedException();
    }

    const provider = this.paymentProviderRegistry.resolve(attempt.provider);
    this.logger.log(
      formatLogFields({
        orderId,
        provider: attempt.provider,
        attemptId: attempt.id,
        monto: order.totalClp,
      }),
    );
    const result = await provider.refund(attempt, order.totalClp);
    if (!result.succeeded) {
      this.logger.warn(
        formatLogFields({ orderId, provider: attempt.provider, attemptId: attempt.id }),
      );
      await this.events.traced(
        new PaymentTracedEvent(
          orderId,
          attempt.provider,
          PaymentTraceType.RefundFailed,
          PaymentTraceSource.Refund,
          attempt.id,
          false,
          null,
          null,
          null,
          null,
          result.raw,
        ),
      );
      throw new RefundFailedException();
    }

    await this.events.traced(
      new PaymentTracedEvent(
        orderId,
        attempt.provider,
        PaymentTraceType.Refunded,
        PaymentTraceSource.Refund,
        attempt.id,
        true,
        null,
        null,
        null,
        null,
        result.raw,
      ),
    );

    await this.events.transition(orderId, OrderEventType.RefundRequested, {
      provider: attempt.provider,
      attemptId: attempt.id,
    });

    const fromStatus = order.status;
    order.status = OrderStatus.Refunded;
    const saved = await this.orders.save(order);
    await this.stockReservationService.restoreConsumed(
      order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    );
    await this.events.transition(orderId, OrderEventType.OrderRefunded, {
      fromStatus,
      toStatus: OrderStatus.Refunded,
      provider: attempt.provider,
      attemptId: attempt.id,
    });
    this.logger.log(formatLogFields({ orderId, provider: attempt.provider }));
    return saved;
  }
}
