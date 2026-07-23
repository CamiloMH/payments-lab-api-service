import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PaymentConfirmation,
  type PaymentInitiation,
  type PaymentMethodDescriptor,
  PaymentAttemptStatus,
  PaymentProviderId,
  RedirectKind,
} from '@/domain';
import Stripe from 'stripe';

import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { PaymentMethodLabelKey } from '../../payment-method-label-key.const';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '../../ports/payment-provider.port';
import { RegisterPaymentProvider } from '../../registry/register-provider.decorator';
import { formatLogFields } from '../../../common/logging/format-log-fields';

/**
 * Branding de la Checkout Session hospedada, para alinear la página de Stripe
 * con la identidad "Bold Fintech Dark" del sandbox: fondo oscuro, acento lima
 * y bordes duros. `inter` es la fuente soportada por Stripe más cercana a Geist
 * (su catálogo no incluye Geist ni Space Grotesk). El logo/ícono se heredan del
 * branding de la cuenta en el dashboard; para forzarlos aquí habría que subir el
 * asset con la Files API y pasar su `file` id en `icon`/`logo`.
 */
const STRIPE_BRANDING: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
  display_name: 'Payments',
  font_family: 'inter',
  border_style: 'rectangular',
  background_color: '#050505',
  button_color: '#c6ff3d',
};

/**
 * Adaptador de Stripe Checkout (hosted). Traduce el contrato genérico
 * `PaymentProviderPort` a las llamadas del SDK oficial: crea una Checkout
 * Session (redirect por URL, mismo patrón que Webpay) y confirma el resultado
 * recuperando la sesión server-side en el retorno, sin webhook.
 *
 * Nota CLP: el peso chileno es una moneda "zero-decimal" en Stripe, por lo que
 * los montos van tal cual (sin multiplicar por 100).
 */
@Injectable()
@RegisterPaymentProvider(PaymentProviderId.Stripe)
export class StripeProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.Stripe;

  private readonly logger = new Logger(StripeProvider.name);

  constructor(private readonly configService: ConfigService) {}

  describe(): PaymentMethodDescriptor {
    return {
      id: this.id,
      labelKey: PaymentMethodLabelKey[this.id],
      requiresInscribedCard: false,
      supportsRefund: true,
    };
  }

  async initiatePayment(ctx: InitiatePaymentContext): Promise<PaymentInitiation> {
    this.logger.log(
      formatLogFields({
        attemptId: ctx.attempt.id,
        orderId: ctx.order.id,
        monto: ctx.order.totalClp,
      }),
    );
    const stripe = this.buildClient();

    // Sin `payment_method_types`: se usan los dynamic payment methods del dashboard.
    // Un único line item con el total de la orden: `order.items` no viene cargado
    // como relación en el checkout (igual que Webpay, que solo usa `totalClp`), y
    // el cobro solo necesita el monto total. CLP zero-decimal → monto sin ×100.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'clp',
            product_data: { name: `Orden ${ctx.order.id}` },
            unit_amount: ctx.order.totalClp,
          },
          quantity: 1,
        },
      ],
      success_url: ctx.returnUrl,
      cancel_url: ctx.returnUrl,
      client_reference_id: ctx.order.id,
      branding_settings: STRIPE_BRANDING,
    });

    // El id de la sesión es la referencia con la que se recupera el pago en el retorno.
    ctx.attempt.externalToken = session.id;

    this.logger.log(
      formatLogFields({
        attemptId: ctx.attempt.id,
        orderId: ctx.order.id,
        sessionId: session.id,
      }),
    );

    return { kind: RedirectKind.Url, url: session.url as string };
  }

  async confirmFromCallback(params: {
    query: Record<string, string>;
    body: Record<string, string>;
    attempt: PaymentAttempt;
  }): Promise<PaymentConfirmation> {
    const stripe = this.buildClient();
    const session = await stripe.checkout.sessions.retrieve(params.attempt.externalToken ?? '');
    const confirmation = this.mapSession(session);
    this.logger.log(
      formatLogFields({
        attemptId: params.attempt.id,
        status: session.payment_status,
        approved: confirmation.approved,
        externalPaymentId: confirmation.externalPaymentId,
      }),
    );
    return confirmation;
  }

  async verifyPayment(externalRef: string, _attempt: PaymentAttempt): Promise<PaymentConfirmation> {
    this.logger.log(formatLogFields({ externalRef }));
    const stripe = this.buildClient();
    const session = await stripe.checkout.sessions.retrieve(externalRef);
    return this.mapSession(session);
  }

  async refund(
    attempt: PaymentAttempt,
    amountClp: number,
  ): Promise<{ succeeded: boolean; raw: Record<string, unknown> }> {
    const stripe = this.buildClient();
    try {
      // CLP zero-decimal: el monto del reembolso va sin multiplicar por 100.
      const refund = await stripe.refunds.create({
        payment_intent: attempt.externalPaymentId ?? undefined,
        amount: amountClp,
      });
      this.logger.log(formatLogFields({ attemptId: attempt.id, succeeded: true }));
      return { succeeded: true, raw: refund as unknown as Record<string, unknown> };
    } catch (error) {
      this.logger.error(
        formatLogFields({ attemptId: attempt.id }),
        error instanceof Error ? error.stack : String(error),
      );
      return {
        succeeded: false,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /** Cliente Stripe construido con la key de test/producción leída de env (análogo a `buildTransaction()` de Webpay). */
  private buildClient(): Stripe {
    return new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '');
  }

  /**
   * Normaliza una Checkout Session a `PaymentConfirmation`. `payment_status`
   * `'paid'` es la única señal de éxito; `payment_intent` (id o objeto expandido)
   * se persiste como `externalPaymentId` para poder reembolsar después. La
   * sesión no trae los últimos 4 dígitos sin `expand`, así que `cardLast4` queda null.
   */
  private mapSession(session: Stripe.Checkout.Session): PaymentConfirmation {
    const approved = session.payment_status === 'paid';
    const paymentIntent = session.payment_intent;
    const externalPaymentId =
      typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent?.id ?? null);
    return {
      approved,
      attemptStatus: approved ? PaymentAttemptStatus.Confirmed : PaymentAttemptStatus.Rejected,
      externalPaymentId,
      responseCode: session.payment_status ?? null,
      cardLast4: null,
      raw: session as unknown as Record<string, unknown>,
    };
  }
}
