/**
 * Semántica de cada traza de pago (`PaymentTrace`): qué representó esa
 * interacción con el PSP. Complementa a `PaymentTraceSource` (de dónde vino);
 * juntas forman la bitácora completa de trazabilidad de un pago.
 */
export enum PaymentTraceType {
  /** Se abrió el intento contra el PSP (aún sin resolver). */
  Initiated = 'initiated',
  /** Se redirigió al usuario al PSP (flujo hosted). */
  Redirected = 'redirected',
  /** El PSP confirmó el pago como aprobado. */
  Confirmed = 'confirmed',
  /** El PSP rechazó/anuló el pago. */
  Rejected = 'rejected',
  /** Se ejecutó un reembolso aceptado por el PSP. */
  Refunded = 'refunded',
  /** El PSP rechazó la solicitud de reembolso. */
  RefundFailed = 'refund_failed',
}
