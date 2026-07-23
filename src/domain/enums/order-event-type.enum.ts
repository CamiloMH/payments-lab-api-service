/**
 * Tipos de evento del audit log de una orden (`OrderEvent`). Cada transición
 * relevante del ciclo de vida de la orden queda registrada con uno de estos
 * tipos, formando el historial/timeline que ve el cliente.
 */
export enum OrderEventType {
  OrderCreated = 'order_created',
  PaymentInitiated = 'payment_initiated',
  RedirectedToProvider = 'redirected_to_provider',
  PaymentConfirmed = 'payment_confirmed',
  PaymentRejected = 'payment_rejected',
  OrderPaid = 'order_paid',
  PaymentFailed = 'payment_failed',
  OrderCancelled = 'order_cancelled',
  OrderExpired = 'order_expired',
  RetryStarted = 'retry_started',
  RefundRequested = 'refund_requested',
  OrderRefunded = 'order_refunded',
}
