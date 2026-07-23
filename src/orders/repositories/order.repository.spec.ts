import { OrderStatus } from '@/domain';
import { LessThan } from 'typeorm';
import type { Repository } from 'typeorm';

import { Order } from '../entities/order.entity';
import { OrderRepository } from './order.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

describe('OrderRepository', () => {
  it('findById busca por id sin relaciones', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);

    await repository.findById('order-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('findByIdOrFail busca por id o lanza', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);

    await repository.findByIdOrFail('order-1');

    expect(repo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });

  it('findByIdWithItems busca por id con los items y el producto de cada línea', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);

    await repository.findByIdWithItems('order-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      relations: { items: { product: true } },
    });
  });

  it('findBySessionWithItems lista por sesión con items+producto, más recientes primero', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);

    await repository.findBySessionWithItems('session-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
    });
  });

  it('findBySessionPage pagina por sesión con items+producto y devuelve [items, total]', async () => {
    const repo = mockRepo({ findAndCount: jest.fn().mockResolvedValue([[{ id: 'order-1' }], 5]) });
    const repository = new OrderRepository(repo as unknown as Repository<Order>);

    const result = await repository.findBySessionPage('session-1', 10, 5);

    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      relations: { items: { product: true } },
      order: { createdAt: 'DESC' },
      skip: 10,
      take: 5,
    });
    expect(result).toEqual([[{ id: 'order-1' }], 5]);
  });

  it('findExpirablePendingPayment busca órdenes pending_payment vencidas', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);
    const now = new Date('2026-01-01T00:00:00.000Z');

    await repository.findExpirablePendingPayment(now);

    expect(repo.find).toHaveBeenCalledWith({
      where: { status: OrderStatus.PendingPayment, expiresAt: LessThan(now) },
    });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);
    const order = { id: 'order-1' } as Order;

    await repository.save(order);

    expect(repo.save).toHaveBeenCalledWith(order);
  });

  it('save usa el EntityManager de la transacción cuando se provee', async () => {
    const repo = mockRepo();
    const repository = new OrderRepository(repo as unknown as Repository<Order>);
    const order = { id: 'order-1' } as Order;
    const manager = { save: jest.fn(async (_entity: unknown, value: unknown) => value) };

    await repository.save(order, manager as unknown as import('typeorm').EntityManager);

    expect(manager.save).toHaveBeenCalledWith(Order, order);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
