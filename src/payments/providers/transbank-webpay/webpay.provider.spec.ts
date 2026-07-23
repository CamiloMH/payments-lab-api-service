import { PaymentAttemptStatus, RedirectKind } from '@/domain';

jest.mock('transbank-sdk');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transbankSdk = require('transbank-sdk');

import type { DemoSession } from '../../../session/entities/demo-session.entity';
import type { Order } from '../../../orders/entities/order.entity';
import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { WebpayPlusProvider } from './webpay.provider';

describe('WebpayPlusProvider', () => {
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

  function buildSession(): DemoSession {
    return { id: 'session-1' } as DemoSession;
  }

  let mallTransactionInstance: {
    create: jest.Mock;
    commit: jest.Mock;
    status: jest.Mock;
    refund: jest.Mock;
  };

  beforeEach(() => {
    mallTransactionInstance = {
      create: jest.fn(),
      commit: jest.fn(),
      status: jest.fn(),
      refund: jest.fn(),
    };
    (transbankSdk.WebpayPlus.MallTransaction as jest.Mock).mockImplementation(
      () => mallTransactionInstance,
    );
  });

  describe('describe', () => {
    it('expone metadata: no requiere tarjeta inscrita, soporta refund', () => {
      const provider = new WebpayPlusProvider();
      expect(provider.describe()).toMatchObject({
        requiresInscribedCard: false,
        supportsRefund: true,
      });
    });
  });

  describe('initiatePayment', () => {
    it('crea la transacción y retorna un FormPost con token_ws', async () => {
      mallTransactionInstance.create.mockResolvedValue({
        token: 'tok-123',
        url: 'https://webpay/redirect',
      });
      const provider = new WebpayPlusProvider();

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      expect(initiation).toEqual({
        kind: RedirectKind.FormPost,
        url: 'https://webpay/redirect',
        fields: { token_ws: 'tok-123' },
      });
      expect(mallTransactionInstance.create).toHaveBeenCalledWith(
        'PL-order-1',
        'session-1',
        'https://api.test/callback?pivot=pivot-1',
        expect.any(Array),
      );
    });
  });

  describe('confirmFromCallback', () => {
    it('confirma con éxito cuando token_ws viene solo (caso normal)', async () => {
      mallTransactionInstance.commit.mockResolvedValue({
        response_code: 0,
        authorization_code: 'auth-1',
        card_detail: { card_number: '6623' },
      });
      const provider = new WebpayPlusProvider();
      const attempt = buildAttempt();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: { token_ws: 'tok-123' },
        attempt,
      });

      expect(mallTransactionInstance.commit).toHaveBeenCalledWith('tok-123');
      expect(confirmation).toMatchObject({
        approved: true,
        attemptStatus: PaymentAttemptStatus.Confirmed,
        externalPaymentId: 'auth-1',
        cardLast4: '6623',
      });
      expect(attempt.externalToken).toBe('tok-123');
    });

    it('marca Rejected si Transbank devuelve un response_code distinto de 0', async () => {
      mallTransactionInstance.commit.mockResolvedValue({ response_code: -1 });
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: { token_ws: 'tok-123' },
        attempt: buildAttempt(),
      });

      expect(confirmation.approved).toBe(false);
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Rejected);
    });

    it('marca Aborted sin llamar a commit cuando el usuario cancela (TBK_TOKEN sin token_ws)', async () => {
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: {
          TBK_TOKEN: 'abort-token',
          TBK_ORDEN_COMPRA: 'PL-order-1',
          TBK_ID_SESION: 'session-1',
        },
        attempt: buildAttempt(),
      });

      expect(mallTransactionInstance.commit).not.toHaveBeenCalled();
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Aborted);
      expect(confirmation.approved).toBe(false);
    });

    it('marca Aborted sin commit cuando vienen ambos token_ws y TBK_TOKEN (timeout del formulario)', async () => {
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: { token_ws: 'tok-123', TBK_TOKEN: 'abort-token' },
        attempt: buildAttempt(),
      });

      expect(mallTransactionInstance.commit).not.toHaveBeenCalled();
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Aborted);
    });

    it('marca Error si no viene ningún token reconocible', async () => {
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: {},
        attempt: buildAttempt(),
      });

      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Error);
    });

    it('lee response_code y authorization_code desde details[0] cuando Transbank los anida ahí', async () => {
      mallTransactionInstance.commit.mockResolvedValue({
        details: [{ response_code: 0, authorization_code: 'auth-nested', card_detail: undefined }],
        card_detail: { card_number: '6623' },
      });
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: { token_ws: 'tok-123' },
        attempt: buildAttempt(),
      });

      expect(confirmation).toMatchObject({ approved: true, externalPaymentId: 'auth-nested' });
    });

    it('deja responseCode y cardLast4 en null si Transbank no los informa', async () => {
      mallTransactionInstance.commit.mockResolvedValue({});
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: { token_ws: 'tok-123' },
        attempt: buildAttempt(),
      });

      expect(confirmation).toMatchObject({ approved: false, responseCode: null, cardLast4: null });
    });
  });

  describe('verifyPayment', () => {
    it('consulta el status y lo mapea igual que commit', async () => {
      mallTransactionInstance.status.mockResolvedValue({
        response_code: 0,
        authorization_code: 'auth-2',
      });
      const provider = new WebpayPlusProvider();

      const confirmation = await provider.verifyPayment('tok-123', buildAttempt());

      expect(mallTransactionInstance.status).toHaveBeenCalledWith('tok-123');
      expect(confirmation.approved).toBe(true);
    });
  });

  describe('refund', () => {
    it('retorna succeeded=true cuando Transbank confirma el refund', async () => {
      mallTransactionInstance.refund.mockResolvedValue({ type: 'REVERSED' });
      const provider = new WebpayPlusProvider();

      const result = await provider.refund(buildAttempt({ externalToken: 'tok-123' }), 19980);

      expect(result.succeeded).toBe(true);
      expect(mallTransactionInstance.refund).toHaveBeenCalledWith(
        'tok-123',
        'PLC-attempt-1',
        expect.any(String),
        19980,
      );
    });

    it('retorna succeeded=false si Transbank rechaza el refund', async () => {
      mallTransactionInstance.refund.mockRejectedValue(new Error('rechazado'));
      const provider = new WebpayPlusProvider();

      const result = await provider.refund(buildAttempt({ externalToken: 'tok-123' }), 19980);

      expect(result.succeeded).toBe(false);
      expect(result.raw).toEqual({ error: 'rechazado' });
    });

    it('usa un token vacío si el attempt nunca guardó un externalToken', async () => {
      mallTransactionInstance.refund.mockResolvedValue({ type: 'REVERSED' });
      const provider = new WebpayPlusProvider();

      await provider.refund(buildAttempt({ externalToken: null }), 19980);

      expect(mallTransactionInstance.refund).toHaveBeenCalledWith(
        '',
        'PLC-attempt-1',
        expect.any(String),
        19980,
      );
    });

    it('registra el motivo tal cual cuando el SDK rechaza con un valor que no es un Error', async () => {
      mallTransactionInstance.refund.mockRejectedValue('fallo-no-error');
      const provider = new WebpayPlusProvider();

      const result = await provider.refund(buildAttempt({ externalToken: 'tok-123' }), 19980);

      expect(result).toEqual({ succeeded: false, raw: { error: 'fallo-no-error' } });
    });
  });

  describe('configuración de ambiente', () => {
    it('siempre usa Environment.Integration (sandbox), incluso en producción', async () => {
      mallTransactionInstance.create.mockResolvedValue({
        token: 'tok',
        url: 'https://webpay/redirect',
      });
      const provider = new WebpayPlusProvider();

      await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback',
        session: buildSession(),
      });

      const optionsArg = (transbankSdk.Options as jest.Mock).mock.calls.at(-1)?.[2];
      expect(optionsArg).toBe(transbankSdk.Environment.Integration);
    });
  });
});
