import 'reflect-metadata';
import { Module, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentProviderId, RedirectKind } from '@/domain';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '@/payments/ports/payment-provider.port';
import { RegisterPaymentProvider } from '@/payments/registry/register-provider.decorator';

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

/**
 * `GET /orders/:id` debe validar la propiedad de la sesión (fix IDOR): antes
 * de este fix, cualquier sesión podía leer `buyOrder`/`sessionId` de órdenes
 * ajenas por id, sin más que adivinar/enumerar el nanoid.
 */
describe('GET /orders/:id, aislamiento entre sesiones (e2e)', () => {
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

  it('el dueño puede leer su orden; otra sesión recibe 403', async () => {
    const owner = request.agent(app.getHttpServer());
    const stranger = request.agent(app.getHttpServer());

    await owner.get('/api/v1/session');
    await stranger.get('/api/v1/session');

    const productsRes = await owner.get('/api/v1/products');
    const product = productsRes.body.items.find((p: { available: number }) => p.available >= 1);

    await owner.post('/api/v1/cart/items').send({ productId: product.id, quantity: 1 });
    const checkoutRes = await owner
      .post('/api/v1/checkout')
      .send({ provider: PaymentProviderId.MercadoPagoCheckoutPro });
    const orderId = checkoutRes.body.order.id;

    const ownerRead = await owner.get(`/api/v1/orders/${orderId}`);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.id).toBe(orderId);
    expect(ownerRead.body).not.toHaveProperty('buyOrder');
    expect(ownerRead.body).not.toHaveProperty('sessionId');

    const strangerRead = await stranger.get(`/api/v1/orders/${orderId}`);
    expect(strangerRead.status).toBe(403);
    expect(strangerRead.body.code).toBe('ORDER_NOT_OWNED');
  });
});
