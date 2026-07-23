import { Injectable, Logger } from '@nestjs/common';
import {
  type PaymentConfirmation,
  type PaymentInitiation,
  type PaymentMethodDescriptor,
  PaymentAttemptStatus,
  PaymentProviderId,
  RedirectKind,
} from '@/domain';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  TransactionDetail,
  WebpayPlus,
} from 'transbank-sdk';

import { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { PaymentMethodLabelKey } from '../../payment-method-label-key.const';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '../../ports/payment-provider.port';
import { RegisterPaymentProvider } from '../../registry/register-provider.decorator';
import { TransbankTokenField } from '../transbank-protocol.const';
import { formatLogFields } from '../../../common/logging/format-log-fields';

/** Respuesta cruda de Transbank para create/commit/status; la documentación oficial no expone tipos. */
type TransbankResponse = Record<string, unknown>;

/**
 * Adaptador de Webpay Plus (Mall). Traduce el contrato genérico
 * `PaymentProviderPort` a las llamadas concretas del SDK oficial. Las
 * credenciales de integración (sandbox) son las constantes públicas del SDK;
 * se pueden sobreescribir por env var para apuntar a producción.
 */
@Injectable()
@RegisterPaymentProvider(PaymentProviderId.TransbankWebpayPlus)
export class WebpayPlusProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.TransbankWebpayPlus;

  private readonly logger = new Logger(WebpayPlusProvider.name);

  constructor() {}

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
    const tx = this.buildTransaction();
    const childBuyOrder = this.childBuyOrder(ctx.attempt.id);
    const detail = new TransactionDetail(
      ctx.order.totalClp,
      this.childCommerceCode(),
      childBuyOrder,
    );

    const response = (await tx.create(ctx.order.buyOrder, ctx.session.id, ctx.returnUrl, [
      detail,
    ])) as TransbankResponse;

    this.logger.log(
      formatLogFields({
        attemptId: ctx.attempt.id,
        orderId: ctx.order.id,
        token: response.token as string,
      }),
    );

    return {
      kind: RedirectKind.FormPost,
      url: response.url as string,
      fields: { [TransbankTokenField.TokenWs]: response.token as string },
    };
  }

  /**
   * Maneja los 3 retornos posibles de Webpay: `token_ws` solo (normal);
   * `TBK_TOKEN` sin `token_ws` (usuario canceló); ambos presentes (timeout
   * del formulario). Solo el primer caso llama a `commit`.
   */
  async confirmFromCallback(params: {
    query: Record<string, string>;
    body: Record<string, string>;
    attempt: PaymentAttempt;
  }): Promise<PaymentConfirmation> {
    const merged = { ...params.query, ...params.body };

    if (merged[TransbankTokenField.TbkToken]) {
      this.logger.warn(formatLogFields({ attemptId: params.attempt.id }));
      return this.abortedConfirmation(merged);
    }
    const tokenWs = merged[TransbankTokenField.TokenWs];
    if (!tokenWs) {
      this.logger.warn(formatLogFields({ attemptId: params.attempt.id }));
      return this.errorConfirmation(merged);
    }

    // Se guarda ANTES del commit para que un refund posterior tenga el token aunque el commit falle.
    params.attempt.externalToken = tokenWs;

    const tx = this.buildTransaction();
    const result = (await tx.commit(tokenWs)) as TransbankResponse;
    const confirmation = this.mapTransactionResult(result);
    this.logger.log(
      formatLogFields({
        attemptId: params.attempt.id,
        approved: confirmation.approved,
        responseCode: confirmation.responseCode,
        externalPaymentId: confirmation.externalPaymentId,
      }),
    );
    return confirmation;
  }

  async verifyPayment(externalRef: string, _attempt: PaymentAttempt): Promise<PaymentConfirmation> {
    this.logger.log(formatLogFields({ externalRef }));
    const tx = this.buildTransaction();
    const result = (await tx.status(externalRef)) as TransbankResponse;
    return this.mapTransactionResult(result);
  }

  async refund(
    attempt: PaymentAttempt,
    amountClp: number,
  ): Promise<{ succeeded: boolean; raw: Record<string, unknown> }> {
    const tx = this.buildTransaction();
    const childBuyOrder = this.childBuyOrder(attempt.id);
    try {
      const result = (await tx.refund(
        attempt.externalToken ?? '',
        childBuyOrder,
        this.childCommerceCode(),
        amountClp,
      )) as TransbankResponse;
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

  /** `buyOrder` hijo enviado a Transbank: prefijo `PLC-` + id (25 chars ≤ 26 máx del SDK). */
  private childBuyOrder(attemptId: string): string {
    return `PLC-${attemptId}`;
  }

  private buildTransaction(): InstanceType<typeof WebpayPlus.MallTransaction> {
    const commerceCode = IntegrationCommerceCodes.WEBPAY_PLUS_MALL;
    const apiKey = IntegrationApiKeys.WEBPAY;
    const environment = Environment.Integration;

    return new WebpayPlus.MallTransaction(new Options(commerceCode, apiKey, environment));
  }

  private childCommerceCode(): string {
    return IntegrationCommerceCodes.WEBPAY_PLUS_MALL_CHILD1;
  }

  private mapTransactionResult(result: TransbankResponse): PaymentConfirmation {
    const detail = (Array.isArray(result.details) ? result.details[0] : undefined) as
      TransbankResponse | undefined;
    const responseCode = (detail?.response_code ?? result.response_code) as number | undefined;
    const authorizationCode = (detail?.authorization_code ?? result.authorization_code) as
      string | undefined;
    const cardNumber = (result.card_detail as TransbankResponse | undefined)?.card_number as
      string | undefined;

    const approved = responseCode === 0;
    return {
      approved,
      attemptStatus: approved ? PaymentAttemptStatus.Confirmed : PaymentAttemptStatus.Rejected,
      externalPaymentId: authorizationCode ?? null,
      responseCode: responseCode !== undefined ? String(responseCode) : null,
      cardLast4: cardNumber ? cardNumber.slice(-4) : null,
      raw: result,
    };
  }

  private abortedConfirmation(raw: TransbankResponse): PaymentConfirmation {
    return {
      approved: false,
      attemptStatus: PaymentAttemptStatus.Aborted,
      externalPaymentId: null,
      responseCode: null,
      cardLast4: null,
      raw,
    };
  }

  private errorConfirmation(raw: TransbankResponse): PaymentConfirmation {
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
