import { PaymentAttemptStatus, PaymentProviderId } from '@/domain';
import type { Repository } from 'typeorm';

import { PaymentAttempt } from '../entities/payment-attempt.entity';
import { PaymentAttemptRepository } from './payment-attempt.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOneOrFail: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

describe('PaymentAttemptRepository', () => {
  it('findByIdOrFail busca por id o lanza', async () => {
    const repo = mockRepo();
    const repository = new PaymentAttemptRepository(repo as unknown as Repository<PaymentAttempt>);

    await repository.findByIdOrFail('attempt-1');

    expect(repo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'attempt-1' } });
  });

  it('findByOrderAndProvider busca por orderId y provider', async () => {
    const repo = mockRepo();
    const repository = new PaymentAttemptRepository(repo as unknown as Repository<PaymentAttempt>);

    await repository.findByOrderAndProvider('order-1', PaymentProviderId.MercadoPagoCheckoutPro);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { orderId: 'order-1', provider: PaymentProviderId.MercadoPagoCheckoutPro },
    });
  });

  it('findConfirmedByOrder busca el intento Confirmed de la orden (el que efectivamente pagó)', async () => {
    const repo = mockRepo();
    const repository = new PaymentAttemptRepository(repo as unknown as Repository<PaymentAttempt>);

    await repository.findConfirmedByOrder('order-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: PaymentAttemptStatus.Confirmed },
    });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new PaymentAttemptRepository(repo as unknown as Repository<PaymentAttempt>);
    const attempt = { id: 'attempt-1' } as PaymentAttempt;

    await repository.save(attempt);

    expect(repo.save).toHaveBeenCalledWith(attempt);
  });
});
