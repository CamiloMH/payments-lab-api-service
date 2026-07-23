/** Estados posibles de una orden a lo largo de su ciclo de vida. */
export enum OrderStatus {
  PendingPayment = 'pending_payment',
  Paid = 'paid',
  /** Intento rechazado/abortado; las reservas siguen activas hasta que expiren, permite reintentar. */
  PaymentFailed = 'payment_failed',
  Expired = 'expired',
  Cancelled = 'cancelled',
  /** El pago llegó tras expirar la reserva y no había stock re-tomable → se reembolsó automáticamente. */
  Refunded = 'refunded',
}
