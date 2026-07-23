/**
 * Identificadores de proveedores de pago soportados. Agregar un PSP nuevo es
 * agregar un valor aquí + una migración de columna enum en `payment_attempts`
 * + un módulo en `src/payments/providers/` (ver docs/architecture.md).
 */
export enum PaymentProviderId {
  TransbankWebpayPlus = 'transbank_webpay_plus',
  TransbankOneclick = 'transbank_oneclick',
  MercadoPagoCheckoutPro = 'mercado_pago_checkout_pro',
  Stripe = 'stripe',
}
