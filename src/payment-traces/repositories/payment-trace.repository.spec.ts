import { In, type Repository } from 'typeorm';
import { PaymentProviderId, PaymentTraceSource, PaymentTraceType } from '@/domain';

import { PaymentTrace } from '../entities/payment-trace.entity';
import { PaymentTraceRepository } from './payment-trace.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    save: jest.fn(async (entity: unknown) => entity),
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildTrace(orderId: string, id: string): PaymentTrace {
  return {
    id,
    orderId,
    provider: PaymentProviderId.Stripe,
    type: PaymentTraceType.Confirmed,
    source: PaymentTraceSource.Webhook,
  } as PaymentTrace;
}

describe('PaymentTraceRepository', () => {
  it('findByOrder busca las trazas de la orden en orden cronológico ascendente', async () => {
    const repo = mockRepo();
    const repository = new PaymentTraceRepository(repo as unknown as Repository<PaymentTrace>);

    await repository.findByOrder('order-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      order: { createdAt: 'ASC' },
    });
  });

  it('latestByOrders devuelve un Map vacío sin llamar al repo si no hay ids', async () => {
    const repo = mockRepo();
    const repository = new PaymentTraceRepository(repo as unknown as Repository<PaymentTrace>);

    const result = await repository.latestByOrders([]);

    expect(result.size).toBe(0);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('latestByOrders conserva solo la traza más reciente por orden (una query con IN + DESC)', async () => {
    // El repo devuelve DESC: la primera vista por orderId es la más reciente.
    const repo = mockRepo({
      find: jest
        .fn()
        .mockResolvedValue([
          buildTrace('order-1', 'newest-1'),
          buildTrace('order-1', 'older-1'),
          buildTrace('order-2', 'newest-2'),
        ]),
    });
    const repository = new PaymentTraceRepository(repo as unknown as Repository<PaymentTrace>);

    const result = await repository.latestByOrders(['order-1', 'order-2']);

    expect(repo.find).toHaveBeenCalledWith({
      where: { orderId: In(['order-1', 'order-2']) },
      order: { createdAt: 'DESC' },
    });
    expect(result.get('order-1')?.id).toBe('newest-1');
    expect(result.get('order-2')?.id).toBe('newest-2');
    expect(result.size).toBe(2);
  });
});
