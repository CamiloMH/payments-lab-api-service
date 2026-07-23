import type { Repository } from 'typeorm';

import { OrderEvent } from '../entities/order-event.entity';
import { OrderEventRepository } from './order-event.repository';

describe('OrderEventRepository', () => {
  it('save delega en el repo de TypeORM', async () => {
    const repo = { save: jest.fn(async (entity: unknown) => entity) };
    const repository = new OrderEventRepository(repo as unknown as Repository<OrderEvent>);
    const event = { id: 'event-1' } as OrderEvent;

    await repository.save(event);

    expect(repo.save).toHaveBeenCalledWith(event);
  });

  it('findByOrder lista por orderId, más antiguos primero', async () => {
    const repo = { find: jest.fn().mockResolvedValue([]) };
    const repository = new OrderEventRepository(repo as unknown as Repository<OrderEvent>);

    await repository.findByOrder('order-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      order: { createdAt: 'ASC' },
    });
  });
});
