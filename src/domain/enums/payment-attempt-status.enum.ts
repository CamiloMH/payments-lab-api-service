/** Estados de un intento de pago individual contra un proveedor. */
export enum PaymentAttemptStatus {
  /** Creado en el PSP, aún sin redirigir al usuario. */
  Initiated = 'initiated',
  /** Usuario enviado al PSP; el pago está "en vuelo". */
  Redirected = 'redirected',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
  /** Usuario canceló en el PSP (ej. Transbank sin token_ws). */
  Aborted = 'aborted',
  Expired = 'expired',
  Error = 'error',
}
