import type {
  PaymentConfirmation,
  PaymentInitiation,
  PaymentMethodDescriptor,
  PaymentProviderId,
} from '@/domain';

import type { DemoSession } from '../../session/entities/demo-session.entity';
import type { Order } from '../../orders/entities/order.entity';
import type { InscribedCard } from '../../cards/entities/inscribed-card.entity';
import type { PaymentAttempt } from '../entities/payment-attempt.entity';

/** Contexto necesario para iniciar un pago contra cualquier proveedor. */
export interface InitiatePaymentContext {
  /** Orden con sus items ya cargados (snapshot de precio/cantidad). */
  order: Order;
  /** Intento persistido en estado Initiated; su `id` es el buyOrder "hijo". */
  attempt: PaymentAttempt;
  /** UUID del pivot: el returnUrl/back_url se arma con `?pivot=<pivotUuid>`. */
  pivotUuid: string;
  /** URL de callback: `{PUBLIC_API_URL}/api/v1/payments/callback/{provider}?pivot=...` */
  returnUrl: string;
  session: DemoSession;
  /** Presente solo en el cobro directo con tarjeta inscrita (Oneclick). */
  inscribedCard?: InscribedCard;
}

/**
 * Puerto que TODO proveedor de pago implementa. Agregar un PSP nuevo es
 * implementar esta interfaz y registrarla con `@RegisterPaymentProvider`;
 * ningún otro código del dominio necesita cambiar (Open/Closed).
 */
export interface PaymentProviderPort {
  readonly id: PaymentProviderId;

  /** Metadata para que la web construya el selector de checkout. */
  describe(): PaymentMethodDescriptor;

  initiatePayment(ctx: InitiatePaymentContext): Promise<PaymentInitiation>;

  /**
   * Resuelve el retorno del PSP (callback GET/POST). SIEMPRE debe verificar
   * server-side el resultado; nunca confiar únicamente en la query/body.
   */
  confirmFromCallback(params: {
    query: Record<string, string>;
    body: Record<string, string>;
    attempt: PaymentAttempt;
  }): Promise<PaymentConfirmation>;

  /**
   * Verificación activa por referencia externa. La usan el webhook (MP) y la
   * reconciliación manual; debe ser idempotente si el attempt ya está resuelto.
   */
  verifyPayment(externalRef: string, attempt: PaymentAttempt): Promise<PaymentConfirmation>;

  /** Reembolso: usado cuando un pago llega tras expirar la reserva sin stock re-tomable. */
  refund(
    attempt: PaymentAttempt,
    amountClp: number,
  ): Promise<{ succeeded: boolean; raw: Record<string, unknown> }>;
}
