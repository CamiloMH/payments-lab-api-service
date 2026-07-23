import type { Repository } from 'typeorm';

import { OrderItem } from '../entities/order-item.entity';
import { OrderItemRepository } from './order-item.repository';

describe('OrderItemRepository', () => {
  it('saveMany delega en el repo de TypeORM', async () => {
    const repo = { save: jest.fn(async (entities: unknown) => entities) };
    const repository = new OrderItemRepository(repo as unknown as Repository<OrderItem>);
    const items = [{ id: 'item-1' }] as OrderItem[];

    await repository.saveMany(items);

    expect(repo.save).toHaveBeenCalledWith(items);
  });
});
