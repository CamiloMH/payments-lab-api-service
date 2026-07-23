import type { Repository } from 'typeorm';

import { CartItemRepository } from './cart-item.repository';
import { CartItem } from '../entities/cart-item.entity';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    delete: jest.fn(),
    ...overrides,
  };
}

describe('CartItemRepository', () => {
  it('findByCartAndProduct busca el ítem por cartId y productId', async () => {
    const repo = mockRepo();
    const repository = new CartItemRepository(repo as unknown as Repository<CartItem>);

    await repository.findByCartAndProduct('cart-1', 'p1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { cartId: 'cart-1', productId: 'p1' } });
  });

  it('create delega en el repo de TypeORM sin persistir', () => {
    const repo = mockRepo();
    const repository = new CartItemRepository(repo as unknown as Repository<CartItem>);

    repository.create({ cartId: 'cart-1', productId: 'p1', quantity: 2 });

    expect(repo.create).toHaveBeenCalledWith({ cartId: 'cart-1', productId: 'p1', quantity: 2 });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new CartItemRepository(repo as unknown as Repository<CartItem>);
    const item = { id: 'item-1' } as CartItem;

    await repository.save(item);

    expect(repo.save).toHaveBeenCalledWith(item);
  });

  it('deleteById elimina el ítem por id', async () => {
    const repo = mockRepo();
    const repository = new CartItemRepository(repo as unknown as Repository<CartItem>);

    await repository.deleteById('item-1');

    expect(repo.delete).toHaveBeenCalledWith({ id: 'item-1' });
  });
});
