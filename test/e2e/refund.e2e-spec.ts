import 'reflect-metadata';
import { Module, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  OrderEventType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProviderId,
  RedirectKind,
} from '@/domain';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '@/payments/ports/payment-provider.port';
import { RegisterPaymentProvider } from '@/payments/registry/register-provider.decorator';

/** Controla, entre tests, si el "PSP" fake acepta o rechaza el refund. */
let refundSucceeds = true;

/** Cobro directo (como Oneclick) siempre aprobado, para dejar la orden `paid` sin redirección. */
@RegisterPaymentProvider(PaymentProviderId.MercadoPagoCheckoutPro)
class FakeDirectChargeProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.MercadoPagoCheckoutPro;

  describe() {
    return {
      id: this.id,
      labelKey: 'paymentMethods.fake',
      requiresInscribedCard: false,
      supportsRefund: true,
    };
  }

  async initiatePayment(ctx: InitiatePaymentContext) {
    return {
      kind: RedirectKind.None as const,
      confirmation: {
        approved: true,
        attemptStatus: PaymentAttemptStatus.Confirmed,
        externalPaymentId: `fake-${ctx.attempt.id}`,
        responseCode: '00',
        cardLast4: null,
        raw: {},
      },
    };
  }

  async confirmFromCallback(): Promise<never> {
    throw new Error('no usado en este e2e');
  }

  async verifyPayment(): Promise<never> {
    throw new Error('no usado en este e2e');
  }

  async refund() {
    return { succeeded: refundSucceeds, raw: {} };
  }
}

@Module({ providers: [FakeDirectChargeProvider] })
class FakeProvidersTestModule {}

describe('POST /orders/:id/refund (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, FakeProvidersTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function checkoutPaidOrder(agent: ReturnType<typeof request.agent>) {
    await agent.get('/api/v1/session');

    const productsRes = await agent.get('/api/v1/products');
    const product = productsRes.body.items.find((p: { available: number }) => p.available >= 1);

    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const checkoutRes = await agent
      .post('/api/v1/checkout')
      .send({ provider: PaymentProviderId.MercadoPagoCheckoutPro });
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.order.status).toBe(OrderStatus.Paid);

    return { orderId: checkoutRes.body.order.id as string, product };
  }

  it('devuelve una orden pagada: transiciona a refunded, restaura stock y puebla el timeline', async () => {
    refundSucceeds = true;
    const agent = request.agent(app.getHttpServer());
    const { orderId, product } = await checkoutPaidOrder(agent);

    const availableAfterPaid = (await agent.get(`/api/v1/products/${product.id}`)).body.available;
    expect(availableAfterPaid).toBe(product.available - 1);

    const timelineBefore = await agent.get(`/api/v1/orders/${orderId}/timeline`);
    expect(timelineBefore.status).toBe(200);
    const typesBefore = timelineBefore.body.map((event: { type: string }) => event.type);
    expect(typesBefore).toEqual(
      expect.arrayContaining([
        OrderEventType.OrderCreated,
        OrderEventType.PaymentInitiated,
        OrderEventType.OrderPaid,
      ]),
    );

    const refundRes = await agent.post(`/api/v1/orders/${orderId}/refund`);
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.status).toBe(OrderStatus.Refunded);

    const availableAfterRefund = (await agent.get(`/api/v1/products/${product.id}`)).body.available;
    expect(availableAfterRefund).toBe(product.available);

    const timelineAfter = await agent.get(`/api/v1/orders/${orderId}/timeline`);
    const typesAfter = timelineAfter.body.map((event: { type: string }) => event.type);
    expect(typesAfter).toEqual(
      expect.arrayContaining([OrderEventType.RefundRequested, OrderEventType.OrderRefunded]),
    );

    const secondRefund = await agent.post(`/api/v1/orders/${orderId}/refund`);
    expect(secondRefund.status).toBe(409);
    expect(secondRefund.body.code).toBe('ORDER_NOT_REFUNDABLE');
  });

  it('propaga el rechazo del proveedor sin cambiar el estado de la orden', async () => {
    refundSucceeds = false;
    const agent = request.agent(app.getHttpServer());
    const { orderId } = await checkoutPaidOrder(agent);

    const refundRes = await agent.post(`/api/v1/orders/${orderId}/refund`);
    expect(refundRes.status).toBe(502);
    expect(refundRes.body.code).toBe('REFUND_FAILED');

    const orderRes = await agent.get(`/api/v1/orders/${orderId}`);
    expect(orderRes.body.status).toBe(OrderStatus.Paid);
  });

  it('rechaza el refund de una orden ajena', async () => {
    refundSucceeds = true;
    const owner = request.agent(app.getHttpServer());
    const stranger = request.agent(app.getHttpServer());
    await stranger.get('/api/v1/session');

    const { orderId } = await checkoutPaidOrder(owner);

    const strangerRefund = await stranger.post(`/api/v1/orders/${orderId}/refund`);
    expect(strangerRefund.status).toBe(403);
    expect(strangerRefund.body.code).toBe('ORDER_NOT_OWNED');
  });
});
