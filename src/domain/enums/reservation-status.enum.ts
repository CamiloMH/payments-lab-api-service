/** Estados de una reserva de stock (una fila por producto dentro de una orden). */
export enum ReservationStatus {
  Active = 'active',
  /** La orden asociada se pagó: el stock se consumió definitivamente. */
  Consumed = 'consumed',
  /** Liberada explícitamente (cancelación o fallo del intento de pago). */
  Released = 'released',
  /** Liberada por vencer su TTL sin pago confirmado. */
  Expired = 'expired',
}
