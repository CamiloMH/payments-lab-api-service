import type { ConfigService } from '@nestjs/config';
import { CardStatus, PaymentProviderId, RedirectKind } from '@/domain';

import type { DemoSession } from '../session/entities/demo-session.entity';
import { CardsService } from './cards.service';
import type { CallbackPivotService } from '../callback-pivots/callback-pivot.service';
import { CallbackPivot } from '../callback-pivots/entities/callback-pivot.entity';
import { CardNotFoundException, CardNotOwnedException } from './exceptions/card.exceptions';
import { InscribedCard } from './entities/inscribed-card.entity';
import type { InscribedCardRepository } from './repositories/inscribed-card.repository';
import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import type { CardEnrollmentPort } from './ports/card-enrollment.port';
import type { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findActiveBySession: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

function buildSession(): DemoSession {
  return { id: 'session-1' } as DemoSession;
}

describe('CardsService', () => {
  function buildDeps(
    overrides: {
      enrollmentPort?: Partial<CardEnrollmentPort>;
      cardsRepoOverrides?: Partial<Record<string, jest.Mock>>;
    } = {},
  ) {
    const cardsRepo = mockRepo(overrides.cardsRepoOverrides) as unknown as InscribedCardRepository;
    const pivots = {
      create: jest.fn().mockResolvedValue({ id: 'pivot-1' } as CallbackPivot),
      attachExternalToken: jest.fn(),
      consume: jest.fn(),
    } as unknown as CallbackPivotService;

    const enrollmentPort: CardEnrollmentPort = {
      id: PaymentProviderId.TransbankOneclick,
      initiateEnrollment: jest.fn(),
      confirmEnrollment: jest.fn(),
      deleteEnrollment: jest.fn(),
      ...overrides.enrollmentPort,
    } as CardEnrollmentPort;

    const registry = {
      resolve: jest.fn().mockReturnValue(enrollmentPort),
    } as unknown as PaymentProviderRegistry;
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const events = {
      transition: jest.fn().mockResolvedValue([]),
      settled: jest.fn(),
      traced: jest.fn().mockResolvedValue([]),
      tracedFromConfirmation: jest.fn().mockResolvedValue([]),
      cardEnrolled: jest.fn(),
      stockChanged: jest.fn(),
    };

    const service = new CardsService(
      cardsRepo,
      pivots,
      registry,
      configService,
      events as unknown as DomainEventPublisher,
    );
    return { service, cardsRepo, pivots, enrollmentPort, registry, events };
  }

  describe('initiateEnrollment', () => {
    it('crea un pivot, delega en el CardEnrollmentPort y guarda el token de start() en el pivot', async () => {
      const { service, pivots, enrollmentPort } = buildDeps({
        enrollmentPort: {
          initiateEnrollment: jest.fn().mockResolvedValue({
            kind: RedirectKind.FormPost,
            url: 'https://webpay/inscribe',
            fields: { TBK_TOKEN: 'enroll-token' },
          }),
        },
      });

      const initiation = await service.initiateEnrollment(buildSession());

      expect(pivots.create).toHaveBeenCalledWith(
        expect.objectContaining({ enrollmentSessionId: 'session-1' }),
      );
      expect(enrollmentPort.initiateEnrollment).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({ id: 'session-1' }),
          pivotUuid: 'pivot-1',
        }),
      );
      // El token que devuelve start() se persiste en el pivot: es el que finish() usará en el callback.
      expect(pivots.attachExternalToken).toHaveBeenCalledWith('pivot-1', 'enroll-token');
      expect(initiation.kind).toBe(RedirectKind.FormPost);
    });
  });

  describe('confirmEnrollment', () => {
    it('consume el pivot, finaliza con el token guardado y persiste la tarjeta si fue aprobada', async () => {
      const pivot = {
        id: 'pivot-1',
        enrollmentSessionId: 'session-1',
        externalToken: 'enroll-token',
      } as CallbackPivot;
      const confirmEnrollment = jest
        .fn()
        .mockResolvedValue({
          tbkUser: 'tbk-1',
          cardType: 'Visa',
          cardLast4: '6623',
          responseCode: 0,
        });
      const { service, cardsRepo, pivots, events } = buildDeps({
        enrollmentPort: { confirmEnrollment },
      });
      (pivots.consume as jest.Mock).mockResolvedValue(pivot);

      const result = await service.confirmEnrollment('pivot-1');

      expect(pivots.consume).toHaveBeenCalledWith('pivot-1');
      // Usa el token del pivot, no uno reenviado por Transbank.
      expect(confirmEnrollment).toHaveBeenCalledWith({ tbkToken: 'enroll-token' });
      expect(cardsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          tbkUser: 'tbk-1',
          status: CardStatus.Active,
        }),
      );
      expect(events.cardEnrolled).toHaveBeenCalledWith('session-1', undefined, 'Visa', '6623');
      expect(result.responseCode).toBe(0);
    });

    it('no persiste la tarjeta si la inscripción fue rechazada', async () => {
      const pivot = {
        id: 'pivot-1',
        enrollmentSessionId: 'session-1',
        externalToken: 'enroll-token',
      } as CallbackPivot;
      const { service, cardsRepo, pivots, events } = buildDeps({
        enrollmentPort: {
          confirmEnrollment: jest
            .fn()
            .mockResolvedValue({ tbkUser: '', cardType: '', cardLast4: '', responseCode: -1 }),
        },
      });
      (pivots.consume as jest.Mock).mockResolvedValue(pivot);

      await service.confirmEnrollment('pivot-1');

      expect(cardsRepo.save).not.toHaveBeenCalled();
      expect(events.cardEnrolled).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('lista solo las tarjetas Active de la sesión', async () => {
      const { service, cardsRepo } = buildDeps();

      await service.list('session-1');

      expect(cardsRepo.findActiveBySession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('delete', () => {
    it('elimina la tarjeta vía el provider y la marca Deleted', async () => {
      const card = {
        id: 'card-1',
        sessionId: 'session-1',
        status: CardStatus.Active,
      } as InscribedCard;
      const { service, cardsRepo, enrollmentPort } = buildDeps({
        cardsRepoOverrides: { findById: jest.fn().mockResolvedValue(card) },
      });

      await service.delete('card-1', buildSession());

      expect(enrollmentPort.deleteEnrollment).toHaveBeenCalledWith(
        card,
        expect.objectContaining({ id: 'session-1' }),
      );
      expect(cardsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CardStatus.Deleted }),
      );
    });

    it('lanza CardNotFoundException si la tarjeta no existe', async () => {
      const { service } = buildDeps({
        cardsRepoOverrides: { findById: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.delete('missing', buildSession())).rejects.toThrow(
        CardNotFoundException,
      );
    });

    it('rechaza eliminar una tarjeta de otra sesión', async () => {
      const card = {
        id: 'card-1',
        sessionId: 'otra-sesion',
        status: CardStatus.Active,
      } as InscribedCard;
      const { service } = buildDeps({
        cardsRepoOverrides: { findById: jest.fn().mockResolvedValue(card) },
      });

      await expect(service.delete('card-1', buildSession())).rejects.toThrow(CardNotOwnedException);
    });
  });
});
