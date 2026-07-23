import { ConfigService } from '@nestjs/config';
import { PaymentAttemptStatus, PaymentProviderId, RedirectKind } from '@/domain';

jest.mock('stripe');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeMock = require('stripe');

import type { Order } from '../../../orders/entities/order.entity';
import type { DemoSession } from '../../../session/entities/demo-session.entity';
import type { PaymentAttempt } from '../../entities/payment-attempt.entity';
import { StripeProvider } from './stripe.provider';

describe('StripeProvider', () => {
  function buildConfig(values: Record<string, string> = {}): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  function buildOrder(): Order {
    return {
      id: 'order-1',
      buyOrder: 'PL-order-1',
      totalClp: 19980,
      items: [{ productName: 'Café de especialidad', unitPriceClp: 9990, quantity: 2 }],
    } as Order;
  }

  function buildAttempt(overrides: Partial<PaymentAttempt> = {}): PaymentAttempt {
    return {
      id: 'attempt-1',
      orderId: 'order-1',
      externalToken: null,
      externalPaymentId: null,
      ...overrides,
    } as PaymentAttempt;
  }

  function buildSession(): DemoSession {
    return { id: 'session-1' } as DemoSession;
  }

  let stripeInstance: {
    checkout: { sessions: { create: jest.Mock; retrieve: jest.Mock } };
    refunds: { create: jest.Mock };
  };

  beforeEach(() => {
    stripeInstance = {
      checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
      refunds: { create: jest.fn() },
    };
    (StripeMock as jest.Mock).mockImplementation(() => stripeInstance);
  });

  describe('describe', () => {
    it('expone metadata: no requiere tarjeta inscrita, soporta refund', () => {
      const provider = new StripeProvider(buildConfig());
      expect(provider.describe()).toEqual({
        id: PaymentProviderId.Stripe,
        labelKey: 'paymentMethods.stripe',
        requiresInscribedCard: false,
        supportsRefund: true,
      });
    });
  });

  describe('initiatePayment', () => {
    it('crea la Checkout Session y retorna un redirect por URL', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe/redirect',
      });
      const provider = new StripeProvider(buildConfig());
      const attempt = buildAttempt();

      const initiation = await provider.initiatePayment({
        order: buildOrder(),
        attempt,
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      expect(initiation).toEqual({
        kind: RedirectKind.Url,
        url: 'https://checkout.stripe/redirect',
      });
      // Guarda el id de la sesión como token externo para recuperarla en el retorno.
      expect(attempt.externalToken).toBe('cs_test_1');
    });

    it('arma un único line item con el total en CLP sin multiplicar por 100 (moneda zero-decimal)', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe/redirect',
      });
      const provider = new StripeProvider(buildConfig());

      await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      const arg = stripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(arg).toMatchObject({
        mode: 'payment',
        success_url: 'https://api.test/callback?pivot=pivot-1',
        cancel_url: 'https://api.test/callback?pivot=pivot-1',
        client_reference_id: 'order-1',
      });
      // Un solo line item con el total de la orden (`order.items` no se carga en el checkout).
      expect(arg.line_items).toEqual([
        {
          price_data: {
            currency: 'clp',
            product_data: { name: 'Orden order-1' },
            unit_amount: 19980,
          },
          quantity: 1,
        },
      ]);
    });

    it('aplica el branding del sandbox (fondo oscuro, acento lima, bordes rectangulares)', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe/redirect',
      });
      const provider = new StripeProvider(buildConfig());

      await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      const arg = stripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(arg.branding_settings).toMatchObject({
        display_name: 'Payments',
        font_family: 'inter',
        border_style: 'rectangular',
        background_color: '#050505',
        button_color: '#c6ff3d',
      });
    });

    it('NO envía payment_method_types (usa dynamic payment methods de Stripe)', async () => {
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe/redirect',
      });
      const provider = new StripeProvider(buildConfig());

      await provider.initiatePayment({
        order: buildOrder(),
        attempt: buildAttempt(),
        pivotUuid: 'pivot-1',
        returnUrl: 'https://api.test/callback?pivot=pivot-1',
        session: buildSession(),
      });

      const arg = stripeInstance.checkout.sessions.create.mock.calls[0][0];
      expect(arg).not.toHaveProperty('payment_method_types');
    });
  });

  describe('confirmFromCallback', () => {
    it('marca Confirmed cuando la sesión está paid y guarda el payment_intent', async () => {
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        payment_status: 'paid',
        payment_intent: 'pi_123',
      });
      const provider = new StripeProvider(buildConfig());
      const attempt = buildAttempt({ externalToken: 'cs_test_1' });

      const confirmation = await provider.confirmFromCallback({ query: {}, body: {}, attempt });

      expect(stripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_1');
      expect(confirmation).toEqual({
        approved: true,
        attemptStatus: PaymentAttemptStatus.Confirmed,
        externalPaymentId: 'pi_123',
        responseCode: 'paid',
        cardLast4: null,
        raw: { payment_status: 'paid', payment_intent: 'pi_123' },
      });
    });

    it('extrae el id cuando payment_intent viene expandido como objeto', async () => {
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        payment_status: 'paid',
        payment_intent: { id: 'pi_expanded' },
      });
      const provider = new StripeProvider(buildConfig());

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: {},
        attempt: buildAttempt({ externalToken: 'cs_test_1' }),
      });

      expect(confirmation.externalPaymentId).toBe('pi_expanded');
    });

    it('marca Rejected cuando la sesión no está paid', async () => {
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        payment_status: 'unpaid',
        payment_intent: null,
      });
      const provider = new StripeProvider(buildConfig());

      const confirmation = await provider.confirmFromCallback({
        query: {},
        body: {},
        attempt: buildAttempt({ externalToken: 'cs_test_1' }),
      });

      expect(confirmation.approved).toBe(false);
      expect(confirmation.attemptStatus).toBe(PaymentAttemptStatus.Rejected);
      expect(confirmation.externalPaymentId).toBeNull();
    });

    it('recupera con token vacío si el attempt nunca guardó externalToken', async () => {
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({ payment_status: 'unpaid' });
      const provider = new StripeProvider(buildConfig());

      await provider.confirmFromCallback({ query: {}, body: {}, attempt: buildAttempt() });

      expect(stripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('');
    });
  });

  describe('verifyPayment', () => {
    it('recupera la sesión por referencia y la mapea igual que confirm', async () => {
      stripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        payment_status: 'paid',
        payment_intent: 'pi_456',
      });
      const provider = new StripeProvider(buildConfig());

      const confirmation = await provider.verifyPayment('cs_test_9', buildAttempt());

      expect(stripeInstance.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_9');
      expect(confirmation).toMatchObject({
        approved: true,
        attemptStatus: PaymentAttemptStatus.Confirmed,
        externalPaymentId: 'pi_456',
      });
    });
  });

  describe('refund', () => {
    it('retorna succeeded=true cuando Stripe confirma el reembolso', async () => {
      stripeInstance.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' });
      const provider = new StripeProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: 'pi_123' }), 19980);

      expect(result.succeeded).toBe(true);
      expect(result.raw).toEqual({ id: 're_1', status: 'succeeded' });
      expect(stripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 19980,
      });
    });

    it('retorna succeeded=false y captura el mensaje si Stripe lanza', async () => {
      stripeInstance.refunds.create.mockRejectedValue(new Error('charge already refunded'));
      const provider = new StripeProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: 'pi_123' }), 19980);

      expect(result).toEqual({ succeeded: false, raw: { error: 'charge already refunded' } });
    });

    it('registra el motivo tal cual cuando el SDK rechaza con un valor que no es Error', async () => {
      stripeInstance.refunds.create.mockRejectedValue('fallo-no-error');
      const provider = new StripeProvider(buildConfig());

      const result = await provider.refund(buildAttempt({ externalPaymentId: 'pi_123' }), 19980);

      expect(result).toEqual({ succeeded: false, raw: { error: 'fallo-no-error' } });
    });
  });
});
