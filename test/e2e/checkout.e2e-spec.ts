import 'reflect-metadata';
import { Module, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentProviderId, RedirectKind } from '@/domain';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '@/payments/ports/payment-provider.port';
import { RegisterPaymentProvider } from '@/payments/registry/register-provider.decorator';

/** Proveedor de prueba: redirige por URL (como Mercado Pago), sin tocar ningún SDK real. */
@RegisterPaymentProvider(PaymentProviderId.MercadoPagoCheckoutPro)
class FakeCheckoutProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.MercadoPagoCheckoutPro;

  describe() {
    return {
      id: this.id,
      labelKey: 'paymentMethods.fake',
      requiresInscribedCard: false,
      supportsRefund: false,
    };
  }

  async initiatePayment(ctx: InitiatePaymentContext) {
    return { kind: RedirectKind.Url as const, url: `https://fake-psp.test/pay/${ctx.attempt.id}` };
  }

  async confirmFromCallback(): Promise<never> {
    throw new Error('no usado en este e2e');
  }

  async verifyPayment(): Promise<never> {
    throw new Error('no usado en este e2e');
  }

  async refund() {
    return { succeeded: false, raw: {} };
  }
}

@Module({ providers: [FakeCheckoutProvider] })
class FakeProvidersTestModule {}

describe('Checkout → cancel → stock vuelve (e2e)', () => {
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

  it('reserva stock al agregar al carrito y hacer checkout, y lo libera al cancelar', async () => {
    const agent = request.agent(app.getHttpServer());

    const sessionRes = await agent.get('/api/v1/session');
    expect(sessionRes.status).toBe(200);

    const productsRes = await agent.get('/api/v1/products');
    expect(productsRes.status).toBe(200);
    const product = productsRes.body.items.find((p: { available: number }) => p.available >= 2);
    expect(product).toBeDefined();
    const initialAvailable = product.available;

    const addItemRes = await agent
      .post('/api/v1/cart/items')
      .send({ productId: product.id, quantity: 2 });
    expect(addItemRes.status).toBe(201);

    const checkoutRes = await agent
      .post('/api/v1/checkout')
      .send({ provider: PaymentProviderId.MercadoPagoCheckoutPro });
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.initiation.kind).toBe(RedirectKind.Url);
    expect(checkoutRes.body.order.status).toBe(OrderStatus.PendingPayment);
    const orderId = checkoutRes.body.order.id;

    const afterCheckoutRes = await agent.get(`/api/v1/products/${product.id}`);
    expect(afterCheckoutRes.body.available).toBe(initialAvailable - 2);

    const cancelRes = await agent.post(`/api/v1/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe(OrderStatus.Cancelled);

    const afterCancelRes = await agent.get(`/api/v1/products/${product.id}`);
    expect(afterCancelRes.body.available).toBe(initialAvailable);
  });

  it('rechaza cancelar dos veces la misma orden (transición inválida)', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/api/v1/session');

    const productsRes = await agent.get('/api/v1/products');
    const product = productsRes.body.items.find((p: { available: number }) => p.available >= 1);

    await agent.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const checkoutRes = await agent
      .post('/api/v1/checkout')
      .send({ provider: PaymentProviderId.MercadoPagoCheckoutPro });
    const orderId = checkoutRes.body.order.id;

    const firstCancel = await agent.post(`/api/v1/orders/${orderId}/cancel`);
    expect(firstCancel.status).toBe(201);

    const secondCancel = await agent.post(`/api/v1/orders/${orderId}/cancel`);
    expect(secondCancel.status).toBe(409);
  });
});
