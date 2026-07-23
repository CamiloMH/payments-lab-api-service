import type { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import type { PaymentProviderId } from '../enums/payment-provider-id.enum';
import { RedirectKind } from '../enums/redirect-kind.enum';

/**
 * Resultado de iniciar un pago. Discriminated union por `kind` que absorbe la
 * asimetría entre PSPs (form POST de Transbank vs. redirect URL de Mercado Pago
 * vs. confirmación inmediata del cobro Oneclick) para que la web renderice el
 * siguiente paso sin conocer el proveedor concreto.
 */
export type PaymentInitiation =
  | { kind: RedirectKind.FormPost; url: string; fields: Record<string, string> }
  | { kind: RedirectKind.Url; url: string }
  | { kind: RedirectKind.None; confirmation: PaymentConfirmation };

/** Resultado normalizado de confirmar/verificar un pago contra un PSP. */
export interface PaymentConfirmation {
  approved: boolean;
  attemptStatus: PaymentAttemptStatus;
  externalPaymentId: string | null;
  responseCode: string | null;
  cardLast4: string | null;
  raw: Record<string, unknown>;
}

/** Metadata de un método de pago para que la UI construya el selector de checkout. */
export interface PaymentMethodDescriptor {
  id: PaymentProviderId;
  /** Clave i18n del nombre visible, ej. 'paymentMethods.webpay'. */
  labelKey: string;
  requiresInscribedCard: boolean;
  supportsRefund: boolean;
}
