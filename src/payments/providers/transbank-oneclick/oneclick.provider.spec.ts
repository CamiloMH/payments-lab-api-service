import { PaymentAttemptStatus, RedirectKind } from '@/domain';

jest.mock('transbank-sdk');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transbankSdk = require('transbank-sdk');

import type { DemoSession } from '../../../session/entities/demo-session.entity';
import type { Order } from '../../../orders/entities/order.entity';
import type { InscribedCard } from '../../../cards/entities/inscribed-card.entity';
import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { CardRequiredException } from '../../../cards/exceptions/card.exceptions';
import { ProviderOperationUnsupportedException } from '../../exceptions/payment-provider.exceptions';
import { OneclickProvider } from './oneclick.provider';

describe('OneclickProvider', () => {
  function buildSession(): DemoSession {
    return { id: 'session-1' } as DemoSession;
  }

  function buildOrder(): Order {
    return { id: 'order-1', buyOrder: 'PL-order-1', totalClp: 19980 } as Order;
  }

  function buildAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
    return {
      id: 'attempt-1',
      orderId: 'order-1',
      externalToken: null,
      ...overrides,
    } as PaymentAttempt;
  }

  function buildInscribedCard(overrides: Partial<InscribedCard> = {}): InscribedCard {
    return {
      id: 'card-1',
      sessionId: 'session-1',
      tbkUser: 'tbk-user-1',
      ...overrides,
    } as InscribedCard;
  }

  let inscriptionInstance: { start: jest.Mock; finish: jest.Mock; delete: jest.Mock };
  let transactionInstance: { authorize: jest.Mock; status: jest.Mock; refund: jest.Mock };

  beforeEach(() => {
    inscriptionInstance = { start: jest.fn(), finish: jest.fn(), delete: jest.fn() };
    transactionInstance = { authorize: jest.fn(), status: jest.fn(), refund: jest.fn() };
    (transbankSdk.Oneclick.MallInscription as jest.Mock).mockImplementation(
      () => inscriptionInstance,
    );
    (transbankSdk.Oneclick.MallTransaction as jest.Mock).mockImplementation(
      () => transactionInstance,
    );
  });

  describe('describe', () => {
    it('requiere tarjeta inscrita y soporta refund', () => {
      const provider = new OneclickProvider();
      expect(provider.describe()).toMatchObject({
        requiresInscribedCard: true,
        supportsRefund: true,
      });
    });
  });

  describe('initiateEnrollment', () => {
    it('inicia la inscripción con username=sessionId y email sintético', async () => {
      // Nota: a diferencia de Webpay Plus, la API de inscripción Oneclick devuelve `url_webpay`, no `url`.
      inscriptionInstance.start.mockResolvedValue({
        token: 'ins-tok',
        url_webpay: 'https://webpay/inscribe',
      });
      const provider = new OneclickProvider();

      const initiation = await provider.initiateEnrollment({
        session: buildSession(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/cards/callback?pivot=pivot-1',
      });

      expect(inscriptionInstance.start).toHaveBeenCalledWith(
        'session-1',
        'demo+session-1@payments-lab.dev',
        'https://api.test/cards/callback?pivot=pivot-1',
      );
      expect(initiation).toEqual({
        kind: RedirectKind.FormPost,
        url: 'https://webpay/inscribe',
        fields: { TBK_TOKEN: 'ins-tok' },
      });
    });
  });

  describe('confirmEnrollment', () => {
    it('finaliza la inscripción y devuelve los datos de la tarjeta', async () => {
      inscriptionInstance.finish.mockResolvedValue({
        response_code: 0,
        tbk_user: 'tbk-user-1',
        card_type: 'Visa',
        card_number: '6623',
      });
      const provider = new OneclickProvider();

      const result = await provider.confirmEnrollment({ tbkToken: 'ins-tok' });

      expect(inscriptionInstance.finish).toHaveBeenCalledWith('ins-tok');
      expect(result).toEqual({
        tbkUser: 'tbk-user-1',
        cardType: 'Visa',
        cardLast4: '6623',
        responseCode: 0,
      });
    });

    it('deja cardLast4 vacío si Transbank no informa el número de tarjeta', async () => {
      inscriptionInstance.finish.mockResolvedValue({
        response_code: 0,
        tbk_user: 'tbk-user-1',
        card_type: 'Visa',
      });
      const provider = new OneclickProvider();

      const result = await provider.confirmEnrollment({ tbkToken: 'ins-tok' });

      expect(result.cardLast4).toBe('');
    });
  });

  describe('deleteEnrollment', () => {
    it('elimina la inscripción usando tbkUser y el id de sesión', async () => {
      const provider = new OneclickProvider();

      await provider.deleteEnrollment(buildInscribedCard(), buildSession());

      expect(inscriptionInstance.delete).toHaveBeenCalledWith('tbk-user-1', 'session-1');
    });
  });

  describe('initiatePayment', () => {
    it('rechaza si no viene una tarjeta inscrita', async () => {
      const provider = new OneclickProvider();

      await expect(
        provider.initiatePayment({
          order: buildOrder(),
          attempt: buildAttempt(),
          pivotUuid: 'pivot-1',
          returnUrl: 'https://api.test/callback',
          session: buildSession(),
        }),
      ).rejects.toThrow(CardRequiredException);
    });

    it('cobra directo con la tarjeta inscrita y retorna RedirectKind.None', async () => {
      transactionInstance.authorize.mockResolvedValue({
        response_code: 0,
        authorization_code: 'auth-1',
        card_detail: { card_number: '6623' },
      });
      const provider = new OneclickProvider();
      const attempt = buildAttempt();

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt,
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback',
        session: buildSession(),
        inscribedCard: buildInscribedCard(),
      });

      expect(transactionInstance.authorize).toHaveBeenCalledWith(
        'session-1',
        'tbk-user-1',
        'PL-order-1',
        expect.any(Array),
      );
      expect(initiation.kind).toBe(RedirectKind.None);
      if (initiation.kind === RedirectKind.None) {
        expect(initiation.confirmation.approved).toBe(true);
        expect(initiation.confirmation.attemptStatus).toBe(PaymentAttemptStatus.Confirmed);
      }
      expect(attempt.externalToken).toBe('PLC-attempt-1');
    });

    it('marca Rejected si Transbank rechaza el cobro', async () => {
      transactionInstance.authorize.mockResolvedValue({ response_code: -1 });
      const provider = new OneclickProvider();

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback',
        session: buildSession(),
        inscribedCard: buildInscribedCard(),
      });

      if (initiation.kind === RedirectKind.None) {
        expect(initiation.confirmation.approved).toBe(false);
        expect(initiation.confirmation.attemptStatus).toBe(PaymentAttemptStatus.Rejected);
      } else {
        throw new Error('se esperaba RedirectKind.None');
      }
    });
  });

  describe('confirmFromCallback', () => {
    it('lanza: Oneclick es cobro directo y no usa callback redirect', async () => {
      const provider = new OneclickProvider();

      await expect(provider.confirmFromCallback()).rejects.toBeInstanceOf(
        ProviderOperationUnsupportedException,
      );
    });
  });

  describe('verifyPayment', () => {
    it('consulta el status por buyOrder', async () => {
      transactionInstance.status.mockResolvedValue({
        response_code: 0,
        authorization_code: 'auth-2',
      });
      const provider = new OneclickProvider();

      const confirmation = await provider.verifyPayment('PLC-attempt-1', buildAttempt());

      expect(transactionInstance.status).toHaveBeenCalledWith('PLC-attempt-1');
      expect(confirmation.approved).toBe(true);
    });

    it('lee response_code desde details[0] cuando Transbank lo anida ahí', async () => {
      transactionInstance.status.mockResolvedValue({
        details: [{ response_code: 0, authorization_code: 'auth-nested' }],
      });
      const provider = new OneclickProvider();

      const confirmation = await provider.verifyPayment('PLC-attempt-1', buildAttempt());

      expect(confirmation).toMatchObject({ approved: true, externalPaymentId: 'auth-nested' });
    });

    it('deja responseCode y cardLast4 en null si Transbank no los informa', async () => {
      transactionInstance.status.mockResolvedValue({});
      const provider = new OneclickProvider();

      const confirmation = await provider.verifyPayment('PLC-attempt-1', buildAttempt());

      expect(confirmation).toMatchObject({ approved: false, responseCode: null, cardLast4: null });
    });
  });

  describe('refund', () => {
    it('reembolsa usando el buyOrder padre y el buyOrder hijo', async () => {
      transactionInstance.refund.mockResolvedValue({ type: 'REVERSED' });
      const provider = new OneclickProvider();

      const result = await provider.refund(buildAttempt(), 19980);

      expect(result.succeeded).toBe(true);
      expect(transactionInstance.refund).toHaveBeenCalledWith(
        'PL-order-1',
        expect.any(String),
        'PLC-attempt-1',
        19980,
      );
    });

    it('retorna succeeded=false si Transbank rechaza el refund', async () => {
      transactionInstance.refund.mockRejectedValue(new Error('rechazado'));
      const provider = new OneclickProvider();

      const result = await provider.refund(buildAttempt(), 19980);

      expect(result.succeeded).toBe(false);
      expect(result.raw).toEqual({ error: 'rechazado' });
    });

    it('registra el motivo tal cual cuando el SDK rechaza con un valor que no es un Error', async () => {
      transactionInstance.refund.mockRejectedValue('fallo-no-error');
      const provider = new OneclickProvider();

      const result = await provider.refund(buildAttempt(), 19980);

      expect(result).toEqual({ succeeded: false, raw: { error: 'fallo-no-error' } });
    });
  });

  describe('configuración de ambiente', () => {
    it('siempre usa Environment.Integration (sandbox), incluso en producción', async () => {
      inscriptionInstance.start.mockResolvedValue({
        token: 'ins-tok',
        url_webpay: 'https://webpay/inscribe',
      });
      const provider = new OneclickProvider();

      await provider.initiateEnrollment({
        session: buildSession(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/cards/callback',
      });

      const optionsArg = (transbankSdk.Options as jest.Mock).mock.calls.at(-1)?.[2];
      expect(optionsArg).toBe(transbankSdk.Environment.Integration);
    });
  });
});
