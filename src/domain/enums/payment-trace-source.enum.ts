/**
 * Origen de una traza de pago (`PaymentTrace`): qué canal produjo esta
 * interacción con el PSP. Permite distinguir, p. ej., una confirmación que
 * llegó por el retorno redirect (`Callback`) de una que llegó por el webhook
 * asíncrono (`Webhook`) aunque el resultado sea el mismo.
 */
export enum PaymentTraceSource {
  /** Al iniciar el pago desde el checkout (incluye el cobro directo Oneclick). */
  Initiation = 'initiation',
  /** Retorno redirect del PSP (Webpay/Stripe/Oneclick). */
  Callback = 'callback',
  /** Notificación asíncrona del PSP (webhook de Mercado Pago). */
  Webhook = 'webhook',
  /** Verificación activa por referencia externa (reconciliación). */
  Verification = 'verification',
  /** Solicitud de reembolso contra el PSP. */
  Refund = 'refund',
}
