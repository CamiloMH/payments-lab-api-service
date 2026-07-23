import type { Repository } from 'typeorm';

import { DemoSession } from '../entities/demo-session.entity';
import { DemoSessionRepository } from './demo-session.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

describe('DemoSessionRepository', () => {
  it('findById busca por id', async () => {
    const repo = mockRepo();
    const repository = new DemoSessionRepository(repo as unknown as Repository<DemoSession>);

    await repository.findById('session-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'session-1' } });
  });

  it('create delega en el repo de TypeORM sin persistir', () => {
    const repo = mockRepo();
    const repository = new DemoSessionRepository(repo as unknown as Repository<DemoSession>);

    repository.create();

    expect(repo.create).toHaveBeenCalledWith({});
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new DemoSessionRepository(repo as unknown as Repository<DemoSession>);
    const session = { id: 'session-1' } as DemoSession;

    await repository.save(session);

    expect(repo.save).toHaveBeenCalledWith(session);
  });
});
