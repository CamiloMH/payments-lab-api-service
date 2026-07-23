import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus, PaymentProviderId, type PaymentInitiation, RedirectKind } from '@/domain';

import { DEFAULT_PUBLIC_API_URL } from '../common/config.defaults';
import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { formatLogFields } from '../common/logging/format-log-fields';
import type { DemoSession } from '../session/entities/demo-session.entity';
import { CallbackPivotService } from '../callback-pivots/callback-pivot.service';
import { InscribedCard } from './entities/inscribed-card.entity';
import { CardNotFoundException, CardNotOwnedException } from './exceptions/card.exceptions';
import { TransbankTokenField } from '../payments/providers/transbank-protocol.const';
import { InscribedCardRepository } from './repositories/inscribed-card.repository';
import type { CardEnrollmentPort } from './ports/card-enrollment.port';
import { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';

/** Resultado de `confirmEnrollment`, reexportado para el controller. */
export interface ConfirmEnrollmentResult {
  tbkUser: string;
  cardType: string;
  cardLast4: string;
  responseCode: number;
}

/**
 * Orquesta la inscripción/eliminación de tarjetas Oneclick: crea el pivot,
 * delega en el `CardEnrollmentPort` resuelto desde el registry, y persiste
 * la tarjeta solo si Transbank aprobó la inscripción (`responseCode === 0`).
 */
@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly cards: InscribedCardRepository,
    private readonly callbackPivotService: CallbackPivotService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly configService: ConfigService,
    private readonly events: DomainEventPublisher,
  ) {}

  /** Crea un pivot de inscripción y devuelve el `PaymentInitiation` (siempre `form_post` con Oneclick) para redirigir a Transbank. */
  async initiateEnrollment(session: DemoSession): Promise<PaymentInitiation> {
    this.logger.log(formatLogFields({ sessionId: session.id }));
    const pivot = await this.callbackPivotService.create({
      enrollmentSessionId: session.id,
      redirectPath: '/checkout',
    });

    const publicApiUrl = this.configService.get<string>('PUBLIC_API_URL') ?? DEFAULT_PUBLIC_API_URL;
    const returnUrl = `${publicApiUrl}/api/v1/cards/callback/transbank?pivot=${pivot.id}`;

    const initiation = await this.resolveEnrollmentPort().initiateEnrollment({
      session,
      pivotUuid: pivot.id,
      returnUrl,
    });

    // El token que devuelve `start()` (viaja en el form como `TBK_TOKEN`) es el
    // que `finish()` necesitará en el callback. Lo guardamos en el pivot para no
    // depender de que Transbank lo reenvíe en el retorno (llega vacío).
    if (initiation.kind === RedirectKind.FormPost) {
      const enrollmentToken = initiation.fields[TransbankTokenField.TbkToken];
      if (enrollmentToken) {
        await this.callbackPivotService.attachExternalToken(pivot.id, enrollmentToken);
      }
    }

    this.logger.log(formatLogFields({ pivotId: pivot.id, kind: initiation.kind }));

    return initiation;
  }

  /**
   * `consume(pivotId)` y `confirmEnrollment(...)` no comparten datos, pero
   * `consume` es deliberadamente el primer paso, no un `Promise.all`: es el
   * gate de idempotencia/expiración del pivot (protege contra reprocesar un
   * mismo callback). Paralelizarlos ejecutaría la inscripción contra
   * Transbank antes de validar que el pivot siga vigente.
   */
  async confirmEnrollment(pivotId: string): Promise<ConfirmEnrollmentResult> {
    this.logger.log(formatLogFields({ pivotId }));
    const pivot = await this.callbackPivotService.consume(pivotId);
    // El token viene del pivot (lo guardó `initiateEnrollment`), no del retorno de Transbank.
    const result = await this.resolveEnrollmentPort().confirmEnrollment({
      tbkToken: pivot.externalToken ?? '',
    });

    if (result.responseCode === 0) {
      const card = this.cards.create({
        sessionId: pivot.enrollmentSessionId!,
        tbkUser: result.tbkUser,
        cardType: result.cardType,
        cardLast4: result.cardLast4,
        status: CardStatus.Active,
      });
      await this.cards.save(card);
      this.events.cardEnrolled(pivot.enrollmentSessionId!, card.id, card.cardType, card.cardLast4);
    }

    this.logger[result.responseCode === 0 ? 'log' : 'warn'](
      formatLogFields({
        cardLast4: result.cardLast4,
        cardType: result.cardType,
        responseCode: result.responseCode,
      }),
    );

    return result;
  }

  /** Lista las tarjetas activas de la sesión (no incluye las eliminadas). */
  async list(sessionId: string): Promise<InscribedCard[]> {
    return this.cards.findActiveBySession(sessionId);
  }

  /**
   * Elimina la inscripción en Transbank y marca la tarjeta `Deleted` localmente.
   * @throws {CardNotFoundException} si no existe.
   * @throws {CardNotOwnedException} si no pertenece a la sesión.
   */
  async delete(cardId: string, session: DemoSession): Promise<void> {
    this.logger.log(formatLogFields({ cardId, sessionId: session.id }));
    const card = await this.cards.findById(cardId);
    if (!card) {
      throw new CardNotFoundException(cardId);
    }
    if (card.sessionId !== session.id) {
      throw new CardNotOwnedException();
    }

    await this.resolveEnrollmentPort().deleteEnrollment(card, session);

    card.status = CardStatus.Deleted;
    await this.cards.save(card);
  }

  /** Único proveedor con tarjetas hoy; si se agrega otro con `CardEnrollmentPort`, se decide aquí. */
  private resolveEnrollmentPort(): CardEnrollmentPort {
    return this.paymentProviderRegistry.resolve(
      PaymentProviderId.TransbankOneclick,
    ) as unknown as CardEnrollmentPort;
  }
}
