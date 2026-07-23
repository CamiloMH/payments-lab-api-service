import { Injectable, Logger } from '@nestjs/common';
import {
  type PaymentConfirmation,
  type PaymentInitiation,
  type PaymentMethodDescriptor,
  PaymentAttemptStatus,
  PaymentProviderId,
  RedirectKind,
  SYNTHETIC_EMAIL_DOMAIN,
} from '@/domain';
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Oneclick,
  Options,
  TransactionDetail,
} from 'transbank-sdk';

import type { DemoSession } from '../../../session/entities/demo-session.entity';
import { InscribedCard } from '../../../cards/entities/inscribed-card.entity';
import { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { CardRequiredException } from '../../../cards/exceptions/card.exceptions';
import { ProviderOperationUnsupportedException } from '../../exceptions/payment-provider.exceptions';
import { PaymentMethodLabelKey } from '../../payment-method-label-key.const';
import type { CardEnrollmentPort } from '../../../cards/ports/card-enrollment.port';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '../../ports/payment-provider.port';
import { RegisterPaymentProvider } from '../../registry/register-provider.decorator';
import { TransbankTokenField } from '../transbank-protocol.const';
import { formatLogFields } from '../../../common/logging/format-log-fields';

type TransbankResponse = Record<string, unknown>;

/**
 * Adaptador de Oneclick Mall. Implementa dos puertos: `CardEnrollmentPort`
 * (inscribir/eliminar tarjeta) y `PaymentProviderPort` (cobro directo con la
 * tarjeta ya inscrita, sin redirect, `RedirectKind.None`).
 */
@Injectable()
@RegisterPaymentProvider(PaymentProviderId.TransbankOneclick)
export class OneclickProvider implements PaymentProviderPort, CardEnrollmentPort {
  readonly id = PaymentProviderId.TransbankOneclick;

  private readonly logger = new Logger(OneclickProvider.name);

  constructor() {}

  describe(): PaymentMethodDescriptor {
    return {
      id: this.id,
      labelKey: PaymentMethodLabelKey[this.id],
      requiresInscribedCard: true,
      supportsRefund: true,
    };
  }

  // ---- CardEnrollmentPort ----

  async initiateEnrollment(ctx: {
    session: DemoSession;
    pivotUuid: string;
    returnUrl: string;
  }): Promise<PaymentInitiation> {
    this.logger.log(formatLogFields({ sessionId: ctx.session.id, pivotId: ctx.pivotUuid }));
    const inscription = this.buildInscription();
    const email = this.syntheticEmail(ctx.session.id);
    const response = (await inscription.start(
      ctx.session.id,
      email,
      ctx.returnUrl,
    )) as TransbankResponse;

    this.logger.log(
      formatLogFields({ sessionId: ctx.session.id, token: response.token as string }),
    );

    return {
      kind: RedirectKind.FormPost,
      // La API de inscripción Oneclick usa `url_webpay`, a diferencia de Webpay Plus (`url`).
      url: response.url_webpay as string,
      fields: { [TransbankTokenField.TbkToken]: response.token as string },
    };
  }

  async confirmEnrollment(params: {
    tbkToken: string;
  }): Promise<{ tbkUser: string; cardType: string; cardLast4: string; responseCode: number }> {
    const inscription = this.buildInscription();
    const result = (await inscription.finish(params.tbkToken)) as TransbankResponse;
    const cardNumber = String(result.card_number ?? '');
    const responseCode = result.response_code as number;

    // No se loguea tbkUser: es la credencial reutilizable para cobros futuros.
    this.logger.log(formatLogFields({ responseCode, cardLast4: cardNumber.slice(-4) }));

    return {
      tbkUser: result.tbk_user as string,
      cardType: result.card_type as string,
      cardLast4: cardNumber.slice(-4),
      responseCode,
    };
  }

  async deleteEnrollment(card: InscribedCard, session: DemoSession): Promise<void> {
    const inscription = this.buildInscription();
    await inscription.delete(card.tbkUser, session.id);
    this.logger.log(formatLogFields({ cardId: card.id, sessionId: session.id }));
  }

  // ---- PaymentProviderPort ----

  async initiatePayment(ctx: InitiatePaymentContext): Promise<PaymentInitiation> {
    if (!ctx.inscribedCard) {
      throw new CardRequiredException();
    }

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

    const result = (await tx.authorize(
      ctx.session.id,
      ctx.inscribedCard.tbkUser,
      ctx.order.buyOrder,
      [detail],
    )) as TransbankResponse;

    // El cobro es síncrono: se guarda el buyOrder hijo para poder consultar status/refund después.
    ctx.attempt.externalToken = childBuyOrder;

    const confirmation = this.mapTransactionResult(result);
    if (confirmation.approved) {
      this.logger.log(
        formatLogFields({
          attemptId: ctx.attempt.id,
          approved: confirmation.approved,
          responseCode: confirmation.responseCode,
          externalPaymentId: confirmation.externalPaymentId,
        }),
      );
    } else {
      this.logger.warn(
        formatLogFields({
          attemptId: ctx.attempt.id,
          approved: confirmation.approved,
          responseCode: confirmation.responseCode,
        }),
      );
    }

    return { kind: RedirectKind.None, confirmation };
  }

  async confirmFromCallback(): Promise<PaymentConfirmation> {
    throw new ProviderOperationUnsupportedException(
      'Oneclick es un cobro directo (RedirectKind.None): no usa callback redirect',
    );
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
    const parentBuyOrder = `PL-${attempt.orderId}`;
    const childBuyOrder = this.childBuyOrder(attempt.id);
    try {
      const result = (await tx.refund(
        parentBuyOrder,
        this.childCommerceCode(),
        childBuyOrder,
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

  private syntheticEmail(sessionId: string): string {
    return `demo+${sessionId}@${SYNTHETIC_EMAIL_DOMAIN}`;
  }

  private childBuyOrder(attemptId: string): string {
    return `PLC-${attemptId}`;
  }

  private buildInscription(): InstanceType<typeof Oneclick.MallInscription> {
    const commerceCode = IntegrationCommerceCodes.ONECLICK_MALL;
    const apiKey = IntegrationApiKeys.WEBPAY;
    const environment = this.resolveEnvironment();
    return new Oneclick.MallInscription(new Options(commerceCode, apiKey, environment));
  }

  private buildTransaction(): InstanceType<typeof Oneclick.MallTransaction> {
    const commerceCode = IntegrationCommerceCodes.ONECLICK_MALL;
    const apiKey = IntegrationApiKeys.WEBPAY;
    const environment = this.resolveEnvironment();
    return new Oneclick.MallTransaction(new Options(commerceCode, apiKey, environment));
  }

  private resolveEnvironment(): string {
    return Environment.Integration;
  }

  private childCommerceCode(): string {
    return IntegrationCommerceCodes.ONECLICK_MALL_CHILD1;
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
}
