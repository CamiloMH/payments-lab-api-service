import { ConfigService } from '@nestjs/config';
import { PaymentAttemptStatus, RedirectKind } from '@/domain';

jest.mock('mercadopago');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mercadopago = require('mercadopago');

import type { Order } from '../../../orders/entities/order.entity';
import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import type { DemoSession } from '../../../session/entities/demo-session.entity';
import { MercadoPagoProvider } from './mercadopago.provider';

describe('MercadoPagoProvider', () => {
  function buildConfig(values: Record<string, string> = {}): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  function buildOrder(overrides: Partial<Order> = {}): Order {
    return { id: 'order-1', buyOrder: 'PL-order-1', totalClp: 19980, ...overrides } as Order;
  }

  function buildAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
    return {
      id: 'attempt-1',
      orderId: 'order-1',
      externalPaymentId: null,
      ...overrides,
    } as PaymentAttempt;
  }

  function buildSession(): DemoSession {
    return { id: 'session-1' } as DemoSession;
  }

  let preferenceInstance: { create: jest.Mock };
  let paymentInstance: { get: jest.Mock };
  let refundInstance: { create: jest.Mock };

  beforeEach(() => {
    preferenceInstance = { create: jest.fn() };
    paymentInstance = { get: jest.fn() };
    refundInstance = { create: jest.fn() };
    (mercadopago.Preference as jest.Mock).mockImplementation(() => preferenceInstance);
    (mercadopago.Payment as jest.Mock).mockImplementation(() => paymentInstance);
    (mercadopago.PaymentRefund as jest.Mock).mockImplementation(() => refundInstance);
  });

  describe('describe', () => {
    it('no requiere tarjeta inscrita y soporta refund', () => {
      const provider = new MercadoPagoProvider(buildConfig());
      expect(provider.describe()).toMatchObject({
        requiresInscribedCard: false,
        supportsRefund: true,
      });
    });
  });

  describe('initiatePayment', () => {
    it('crea la preferencia y retorna el sandbox_init_point como Url', async () => {
      preferenceInstance.create.mockResolvedValue({
        id: 'pref-1',
        init_point: 'https://mercadopago.cl/checkout/prod',
        sandbox_init_point: 'https://sandbox.mercadopago.cl/checkout/pay',
      });
      const provider = new MercadoPagoProvider(buildConfig());

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      expect(initiation).toEqual({
        kind: RedirectKind.Url,
        url: 'https://sandbox.mercadopago.cl/checkout/pay',
      });
      expect(preferenceInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            external_reference: 'order-1',
            back_urls: {
              success: 'https://api.test/callback?pivot=pivot-1',
              pending: 'https://api.test/callback?pivot=pivot-1',
              failure: 'https://api.test/callback?pivot=pivot-1',
            },
            auto_return: 'approved',
          }),
        }),
      );
    });

    it('usa init_point si no hay sandbox_init_point (entorno producción)', async () => {
      preferenceInstance.create.mockResolvedValue({
        init_point: 'https://mercadopago.cl/checkout/prod',
      });
      const provider = new MercadoPagoProvider(buildConfig());

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback',
        session: buildSession(),
      });

      expect(initiation).toEqual({
        kind: RedirectKind.Url,
        url: 'https://mercadopago.cl/checkout/prod',
      });
    });
  });

  describe('confirmFromCallback', () => {
    it('verifica activamente el pago usando payment_id de la query', async () => {
      paymentInstance.get.mockResolvedValue({
        id: 555,
        status: 'approved',
        status_detail: 'accredited',
      });
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.confirmFromCallback({
        query: { payment_id: '555', status: 'approved' },
        body: {},
        attempt: buildAttempt(),
      });

      expect(paymentInstance.get).toHaveBeenCalledWith({ id: '555' });
      expect(confirmation.approved).toBe(true);
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Confirmed);
    });

    it('acepta collection_id como alias de payment_id', async () => {
      paymentInstance.get.mockResolvedValue({ id: 555, status: 'rejected' });
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.confirmFromCallback({
        query: { collection_id: '555' },
        body: {},
        attempt: buildAttempt(),
      });

      expect(paymentInstance.get).toHaveBeenCalledWith({ id: '555' });
      expect(confirmation.approved).toBe(false);
    });

    it('marca Error si no viene ningún id de pago', async () => {
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: {},
        attempt: buildAttempt(),
      });

      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Error);
      expect(paymentInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('mapea pending/in_process como Redirected (aún sin resolver)', async () => {
      paymentInstance.get.mockResolvedValue({ id: 555, status: 'in_process' });
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.verifyPayment('555', buildAttempt());

      expect(confirmation.approved).toBe(false);
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Redirected);
    });

    it('mapea cancelled como Rejected', async () => {
      paymentInstance.get.mockResolvedValue({ id: 555, status: 'cancelled' });
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.verifyPayment('555', buildAttempt());

      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Rejected);
    });

    it('deja externalPaymentId en null si Mercado Pago no informa un id de pago', async () => {
      paymentInstance.get.mockResolvedValue({ status: 'approved' });
      const provider = new MercadoPagoProvider(buildConfig());

      const confirmation = await provider.verifyPayment('555', buildAttempt());

      expect(confirmation.externalPaymentId).toBeNull();
    });
  });

  describe('resolveOrderId', () => {
    it('obtiene el external_reference (orderId) consultando el pago', async () => {
      paymentInstance.get.mockResolvedValue({ id: 555, external_reference: 'order-1' });
      const provider = new MercadoPagoProvider(buildConfig());

      const orderId = await provider.resolveOrderId('555');

      expect(orderId).toBe('order-1');
    });

    it('retorna null si el pago no trae external_reference', async () => {
      paymentInstance.get.mockResolvedValue({ id: 555 });
      const provider = new MercadoPagoProvider(buildConfig());

      const orderId = await provider.resolveOrderId('555');

      expect(orderId).toBeNull();
    });
  });

  describe('refund', () => {
    it('reembolsa por el externalPaymentId del intento', async () => {
      refundInstance.create.mockResolvedValue({ id: 1, status: 'approved' });
      const provider = new MercadoPagoProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: '555' }), 19980);

      expect(result.succeeded).toBe(true);
      expect(refundInstance.create).toHaveBeenCalledWith({
        payment_id: '555',
        body: { amount: 19980 },
      });
    });

    it('usa un payment_id vacío si el attempt nunca guardó un externalPaymentId', async () => {
      refundInstance.create.mockResolvedValue({ id: 1, status: 'approved' });
      const provider = new MercadoPagoProvider(buildConfig());

      await provider.refund(buildAttempt({ externalPaymentId: null }), 19980);

      expect(refundInstance.create).toHaveBeenCalledWith({
        payment_id: '',
        body: { amount: 19980 },
      });
    });

    it('retorna succeeded=false si Mercado Pago rechaza el refund', async () => {
      refundInstance.create.mockRejectedValue(new Error('rechazado'));
      const provider = new MercadoPagoProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: '555' }), 19980);

      expect(result.succeeded).toBe(false);
      expect(result.raw).toEqual({ error: 'rechazado' });
    });

    it('registra el motivo tal cual cuando el SDK rechaza con un valor que no es un Error', async () => {
      refundInstance.create.mockRejectedValue('fallo-no-error');
      const provider = new MercadoPagoProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: '555' }), 19980);

      expect(result).toEqual({ succeeded: false, raw: { error: 'fallo-no-error' } });
    });
  });
});
