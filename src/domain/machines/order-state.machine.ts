import { OrderStatus } from '../enums/order-status.enum';

/**
 * Única fuente de verdad de las transiciones válidas de una orden. Tanto los
 * callbacks/webhooks de pago como el sweep de expiración deben pasar por
 * `assertOrderTransition` antes de persistir un cambio de estado.
 */
const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PendingPayment]: [
    OrderStatus.Paid,
    OrderStatus.PaymentFailed,
    OrderStatus.Expired,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.PaymentFailed]: [
    OrderStatus.PendingPayment,
    OrderStatus.Expired,
    OrderStatus.Cancelled,
  ],
  // Un pago que llega tras expirar la reserva se resuelve con una re-reserva
  // (si hay stock) o con un reembolso automático (si no lo hay).
  [OrderStatus.Expired]: [OrderStatus.Paid, OrderStatus.Refunded],
  [OrderStatus.Paid]: [],
  [OrderStatus.Cancelled]: [],
  [OrderStatus.Refunded]: [],
};

/** Lanzada al intentar una transición de orden no contemplada en `ORDER_TRANSITIONS`. */
export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Transición de orden inválida: ${from} -> ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

/** Indica si la orden puede pasar de `from` a `to` sin lanzar. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Valida una transición de estado de orden. Debe llamarse dentro de la misma
 * transacción que persiste el cambio, para que una transición inválida
 * aborte el commit en vez de dejar datos inconsistentes.
 *
 * @throws {InvalidOrderTransitionError} si la transición no está permitida.
 */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
