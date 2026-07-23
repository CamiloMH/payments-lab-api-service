import { PaymentProviderId, PaymentTraceSource, PaymentTraceType } from '@/domain';

import { PaymentTrace } from './entities/payment-trace.entity';
import { PaymentTraceRepository } from './repositories/payment-trace.repository';
import { PaymentTraceService } from './payment-trace.service';

function buildRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    save: jest.fn(async (trace: unknown) => trace),
    findByOrder: jest.fn().mockResolvedValue([]),
    latestByOrders: jest.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
}

describe('PaymentTraceService', () => {
  it('record persiste una traza mínima con nulls explícitos', async () => {
    const repo = buildRepo();
    const service = new PaymentTraceService(repo as unknown as PaymentTraceRepository);

    const trace = await service.record({
      orderId: 'order-1',
      provider: PaymentProviderId.Stripe,
      type: PaymentTraceType.Redirected,
      source: PaymentTraceSource.Initiation,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        provider: PaymentProviderId.Stripe,
        type: PaymentTraceType.Redirected,
        source: PaymentTraceSource.Initiation,
        attemptId: null,
        approved: null,
        attemptStatus: null,
        externalPaymentId: null,
        responseCode: null,
        cardLast4: null,
        rawPayload: null,
      }),
    );
    expect(trace).toBeInstanceOf(PaymentTrace);
  });

  it('record persiste todos los campos cuando se proveen', async () => {
    const repo = buildRepo();
    const service = new PaymentTraceService(repo as unknown as PaymentTraceRepository);

    await service.record({
      orderId: 'order-1',
      attemptId: 'attempt-1',
      provider: PaymentProviderId.Stripe,
      type: PaymentTraceType.Confirmed,
      source: PaymentTraceSource.Webhook,
      approved: true,
      responseCode: '0',
      cardLast4: '4242',
      rawPayload: { id: 'pi_123' },
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: 'attempt-1',
        type: PaymentTraceType.Confirmed,
        source: PaymentTraceSource.Webhook,
        approved: true,
        responseCode: '0',
        cardLast4: '4242',
        rawPayload: { id: 'pi_123' },
      }),
    );
  });

  it('listByOrder y latestByOrders delegan en el repositorio', async () => {
    const repo = buildRepo();
    const service = new PaymentTraceService(repo as unknown as PaymentTraceRepository);

    await service.listByOrder('order-1');
    await service.latestByOrders(['order-1', 'order-2']);

    expect(repo.findByOrder).toHaveBeenCalledWith('order-1');
    expect(repo.latestByOrders).toHaveBeenCalledWith(['order-1', 'order-2']);
  });
});
