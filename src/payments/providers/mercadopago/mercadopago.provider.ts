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
import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from 'mercadopago';

import { DEFAULT_PUBLIC_API_URL } from '../../../common/config.defaults';
import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { PaymentMethodLabelKey } from '../../payment-method-label-key.const';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '../../ports/payment-provider.port';
import { RegisterPaymentProvider } from '../../registry/register-provider.decorator';
import { formatLogFields } from '../../../common/logging/format-log-fields';
import { PreferenceBuilder } from './preference.builder';

type MpResponse = Record<string, unknown>;

/** Valores del campo `status` que informa la API de pagos de Mercado Pago. */
const MercadoPagoPaymentStatus = {
  Pending: 'pending',
  InProcess: 'in_process',
  Authorized: 'authorized',
  Approved: 'approved',
} as const;

const IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
  MercadoPagoPaymentStatus.Pending,
  MercadoPagoPaymentStatus.InProcess,
  MercadoPagoPaymentStatus.Authorized,
]);

/**
 * Adaptador Checkout Pro. A diferencia de Transbank, la confirmación nunca
 * llega "de una" en el retorno: tanto el back_url (query `payment_id`) como
 * el webhook exigen una verificación activa (`Payment.get`); nunca se
 * confía en el status que trae la URL.
 */
@Injectable()
@RegisterPaymentProvider(PaymentProviderId.MercadoPagoCheckoutPro)
export class MercadoPagoProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.MercadoPagoCheckoutPro;

  private readonly logger = new Logger(MercadoPagoProvider.name);

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
    const preference = new Preference(this.buildConfig());
    const body = new PreferenceBuilder()
      .forOrder(ctx.order.id, `Orden ${ctx.order.buyOrder}`, ctx.order.totalClp)
      .withReturnUrl(ctx.returnUrl)
      .withNotificationUrl(this.webhookUrl())
      .build();
    const response = (await preference.create({ body })) as unknown as MpResponse;

    this.logger.log(
      formatLogFields({
        attemptId: ctx.attempt.id,
        orderId: ctx.order.id,
        preferenceId: response.id !== undefined ? String(response.id) : null,
      }),
    );

    const url = (response.sandbox_init_point ?? response.init_point) as string;
    return { kind: RedirectKind.Url, url };
  }

  /** El back_url de MP siempre trae `payment_id` (o `collection_id`); nunca su `status` se toma como verdad. */
  async confirmFromCallback(params: {
    query: Record<string, string>;
    body: Record<string, string>;
    attempt: PaymentAttempt;
  }): Promise<PaymentConfirmation> {
    const paymentId = params.query.payment_id || params.query.collection_id;
    if (!paymentId) {
      this.logger.warn(formatLogFields({ attemptId: params.attempt.id }));
      return this.errorConfirmation({});
    }
    return this.verifyPayment(paymentId);
  }

  async verifyPayment(
    externalRef: string,
    _attempt?: PaymentAttempt,
  ): Promise<PaymentConfirmation> {
    this.logger.log(formatLogFields({ externalRef }));
    const payment = new Payment(this.buildConfig());
    const result = (await payment.get({ id: externalRef })) as unknown as MpResponse;
    const confirmation = this.mapPaymentResult(result);
    this.logger.log(
      formatLogFields({
        externalRef,
        approved: confirmation.approved,
        responseCode: confirmation.responseCode,
        externalPaymentId: confirmation.externalPaymentId,
      }),
    );
    return confirmation;
  }

  /** Resuelve el `orderId` (guardado como `external_reference`) a partir del id de pago del webhook. */
  async resolveOrderId(paymentId: string): Promise<string | null> {
    const payment = new Payment(this.buildConfig());
    const result = (await payment.get({ id: paymentId })) as unknown as MpResponse;
    const orderId = (result.external_reference as string | undefined) ?? null;
    this.logger.log(formatLogFields({ paymentId, orderId }));
    return orderId;
  }

  async refund(
    attempt: PaymentAttempt,
    amountClp: number,
  ): Promise<{ succeeded: boolean; raw: Record<string, unknown> }> {
    const refund = new PaymentRefund(this.buildConfig());
    try {
      const result = (await refund.create({
        payment_id: attempt.externalPaymentId ?? '',
        body: { amount: amountClp },
      })) as unknown as MpResponse;
      this.logger.log(formatLogFields({ attemptId: attempt.id, succeeded: true }));
      return { succeeded: true, raw: result };
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

  private buildConfig(): MercadoPagoConfig {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    return new MercadoPagoConfig({ accessToken });
  }

  private webhookUrl(): string {
    const publicApiUrl = this.configService.get<string>('PUBLIC_API_URL') ?? DEFAULT_PUBLIC_API_URL;
    return `${publicApiUrl}/api/v1/webhooks/mercadopago`;
  }

  private mapPaymentResult(result: MpResponse): PaymentConfirmation {
    const status = result.status as string | undefined;
    const approved = status === MercadoPagoPaymentStatus.Approved;
    const attemptStatus = approved
      ? PaymentAttemptStatus.Confirmed
      : status && IN_PROGRESS_STATUSES.has(status)
        ? PaymentAttemptStatus.Redirected
        : PaymentAttemptStatus.Rejected;

    const card = result.card as MpResponse | undefined;
    return {
      approved,
      attemptStatus,
      externalPaymentId: result.id !== undefined ? String(result.id) : null,
      responseCode: (result.status_detail as string | undefined) ?? null,
      cardLast4: (card?.last_four_digits as string | undefined) ?? null,
      raw: result,
    };
  }

  private errorConfirmation(raw: MpResponse): PaymentConfirmation {
    return {
      approved: false,
      attemptStatus: PaymentAttemptStatus.Error,
      externalPaymentId: null,
      responseCode: null,
      cardLast4: null,
      raw,
    };
  }
}
