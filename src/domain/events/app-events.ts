import type { OrderEventType } from '../enums/order-event-type.enum';
import type { OrderStatus } from '../enums/order-status.enum';
import type { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import type { PaymentProviderId } from '../enums/payment-provider-id.enum';
import type { PaymentTraceSource } from '../enums/payment-trace-source.enum';
import type { PaymentTraceType } from '../enums/payment-trace-type.enum';

/**
 * Payloads de los eventos de dominio internos (`@nestjs/event-emitter`). Llevan
 * solo datos planos + enums de dominio (nunca entidades) para no acoplar el
 * `domain` a la capa de persistencia; los listeners reconstruyen lo que
 * necesiten. Ver `AppEvent` para los nombres.
 */

/** Una orden cambió de estado; alimenta el audit log (`order_events`). */
export class OrderTransitionedEvent {
  constructor(
    public readonly orderId: string,
    public readonly type: OrderEventType,
    public readonly fromStatus: OrderStatus | null = null,
    public readonly toStatus: OrderStatus | null = null,
    public readonly provider: PaymentProviderId | null = null,
    public readonly attemptId: string | null = null,
    public readonly detail: string | null = null,
  ) {}
}

/** Una orden llegó a un estado terminal de pago; dispara el push WebSocket. */
export class OrderSettledEvent {
  constructor(
    public readonly orderId: string,
    public readonly status: OrderStatus,
  ) {}
}

/** Una interacción con un PSP que debe quedar registrada en la bitácora de trazas. */
export class PaymentTracedEvent {
  constructor(
    public readonly orderId: string,
    public readonly provider: PaymentProviderId,
    public readonly type: PaymentTraceType,
    public readonly source: PaymentTraceSource,
    public readonly attemptId: string | null = null,
    public readonly approved: boolean | null = null,
    public readonly attemptStatus: PaymentAttemptStatus | null = null,
    public readonly externalPaymentId: string | null = null,
    public readonly responseCode: string | null = null,
    public readonly cardLast4: string | null = null,
    public readonly rawPayload: Record<string, unknown> | null = null,
  ) {}
}

/** Se inscribió una tarjeta Oneclick; dispara el push WebSocket a la sesión. */
export class CardEnrolledEvent {
  constructor(
    public readonly sessionId: string,
    public readonly cardId: string,
    public readonly cardType: string,
    public readonly cardLast4: string,
  ) {}
}

/** Cambió el stock disponible de un producto; dispara el push WebSocket a la tienda. */
export class StockChangedEvent {
  constructor(
    public readonly productId: string,
    public readonly available: number,
  ) {}
}
