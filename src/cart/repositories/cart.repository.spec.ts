import type { Repository } from 'typeorm';

import { CartRepository } from './cart.repository';
import { Cart, CartStatus } from '../entities/cart.entity';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    update: jest.fn(),
    ...overrides,
  };
}

describe('CartRepository', () => {
  it('findActiveBySession busca el carrito Active de la sesión con sus items', async () => {
    const repo = mockRepo();
    const repository = new CartRepository(repo as unknown as Repository<Cart>);

    await repository.findActiveBySession('session-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', status: CartStatus.Active },
      relations: { items: true },
    });
  });

  it('create delega en el repo de TypeORM sin persistir', () => {
    const repo = mockRepo();
    const repository = new CartRepository(repo as unknown as Repository<Cart>);

    repository.create({ sessionId: 'session-1' });

    expect(repo.create).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new CartRepository(repo as unknown as Repository<Cart>);
    const cart = { id: 'cart-1' } as Cart;

    await repository.save(cart);

    expect(repo.save).toHaveBeenCalledWith(cart);
  });

  it('markCheckedOut actualiza el status a CheckedOut', async () => {
    const repo = mockRepo();
    const repository = new CartRepository(repo as unknown as Repository<Cart>);

    await repository.markCheckedOut('cart-1');

    expect(repo.update).toHaveBeenCalledWith({ id: 'cart-1' }, { status: CartStatus.CheckedOut });
  });
});
