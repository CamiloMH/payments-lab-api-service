import type { Repository } from 'typeorm';

import { CallbackPivotRepository } from './callback-pivot.repository';
import { CallbackPivot } from '../entities/callback-pivot.entity';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

describe('CallbackPivotRepository', () => {
  it('findById busca por id', async () => {
    const repo = mockRepo();
    const repository = new CallbackPivotRepository(repo as unknown as Repository<CallbackPivot>);

    await repository.findById('pivot-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'pivot-1' } });
  });

  it('create delega en el repo de TypeORM sin persistir', () => {
    const repo = mockRepo();
    const repository = new CallbackPivotRepository(repo as unknown as Repository<CallbackPivot>);

    repository.create({ redirectPath: '/es/cards' });

    expect(repo.create).toHaveBeenCalledWith({ redirectPath: '/es/cards' });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new CallbackPivotRepository(repo as unknown as Repository<CallbackPivot>);
    const pivot = { id: 'pivot-1' } as CallbackPivot;

    await repository.save(pivot);

    expect(repo.save).toHaveBeenCalledWith(pivot);
  });
});
