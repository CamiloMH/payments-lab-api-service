import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  CardEnrolledEvent,
  type OrderEventType,
  type OrderStatus,
  OrderSettledEvent,
  OrderTransitionedEvent,
  type PaymentConfirmation,
  type PaymentProviderId,
  PaymentTracedEvent,
  type PaymentTraceSource,
  PaymentTraceType,
  StockChangedEvent,
} from '@/domain';

import { formatLogFields } from '../logging/format-log-fields';

/** Metadata opcional de una transición de orden (mismos campos que el audit log). */
export interface TransitionMeta {
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  provider?: PaymentProviderId;
  attemptId?: string;
  detail?: string;
}

/**
 * Fachada tipada sobre `EventEmitter2` para publicar eventos de dominio. Centra
 * en un solo lugar el mapeo a `AppEvent.*` y el criterio de entrega: los
 * side-effects que persisten en DB (audit log, trazas) se publican con
 * `emitAsync` + await (correctness/orden), y el push WebSocket con `emit`
 * (best-effort). Los servicios core dependen de esto en vez de conocer a sus
 * consumidores (gateway, audit, trazas).
 */
@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /** Transición de orden → audit log. Awaitable (persistente). */
  transition(orderId: string, type: OrderEventType, meta: TransitionMeta = {}): Promise<unknown[]> {
    this.logger.log(
      formatLogFields({
        event: AppEvent.OrderTransitioned,
        orderId,
        type,
        fromStatus: meta.fromStatus ?? null,
        toStatus: meta.toStatus ?? null,
        provider: meta.provider ?? null,
        attemptId: meta.attemptId ?? null,
      }),
    );
    return this.emitter.emitAsync(
      AppEvent.OrderTransitioned,
      new OrderTransitionedEvent(
        orderId,
        type,
        meta.fromStatus ?? null,
        meta.toStatus ?? null,
        meta.provider ?? null,
        meta.attemptId ?? null,
        meta.detail ?? null,
      ),
    );
  }

  /** Orden resuelta (paid/failed/refunded) → push WebSocket. Best-effort. */
  settled(orderId: string, status: OrderStatus): void {
    this.logger.log(formatLogFields({ event: AppEvent.OrderSettled, orderId, status }));
    this.emitter.emit(AppEvent.OrderSettled, new OrderSettledEvent(orderId, status));
  }

  /** Traza de pago genérica → bitácora. Awaitable (persistente). */
  traced(event: PaymentTracedEvent): Promise<unknown[]> {
    this.logger.log(
      formatLogFields({
        event: AppEvent.PaymentTraced,
        orderId: event.orderId,
        provider: event.provider,
        type: event.type,
        source: event.source,
        approved: event.approved,
      }),
    );
    return this.emitter.emitAsync(AppEvent.PaymentTraced, event);
  }

  /** Traza derivada de un `PaymentConfirmation` (callback/webhook/verificación/cobro directo). */
  tracedFromConfirmation(
    ref: { orderId: string; attemptId: string; provider: PaymentProviderId },
    confirmation: PaymentConfirmation,
    source: PaymentTraceSource,
  ): Promise<unknown[]> {
    return this.traced(
      new PaymentTracedEvent(
        ref.orderId,
        ref.provider,
        confirmation.approved ? PaymentTraceType.Confirmed : PaymentTraceType.Rejected,
        source,
        ref.attemptId,
        confirmation.approved,
        confirmation.attemptStatus,
        confirmation.externalPaymentId,
        confirmation.responseCode,
        confirmation.cardLast4,
        confirmation.raw,
      ),
    );
  }

  /** Tarjeta Oneclick inscrita → push WebSocket a la sesión. Best-effort. */
  cardEnrolled(sessionId: string, cardId: string, cardType: string, cardLast4: string): void {
    this.logger.log(
      formatLogFields({
        event: AppEvent.CardEnrolled,
        sessionId,
        cardId,
        cardType,
        cardLast4,
      }),
    );
    this.emitter.emit(
      AppEvent.CardEnrolled,
      new CardEnrolledEvent(sessionId, cardId, cardType, cardLast4),
    );
  }

  /** Cambio de stock disponible de un producto → push WebSocket a la tienda. Best-effort. */
  stockChanged(productId: string, available: number): void {
    this.logger.log(formatLogFields({ event: AppEvent.StockChanged, productId, available }));
    this.emitter.emit(AppEvent.StockChanged, new StockChangedEvent(productId, available));
  }
}
