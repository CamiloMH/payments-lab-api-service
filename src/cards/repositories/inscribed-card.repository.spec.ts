import { CardStatus } from '@/domain';
import type { Repository } from 'typeorm';

import { InscribedCard } from '../entities/inscribed-card.entity';
import { InscribedCardRepository } from './inscribed-card.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    ...overrides,
  };
}

describe('InscribedCardRepository', () => {
  it('findActiveBySession lista las tarjetas Active de la sesión', async () => {
    const repo = mockRepo();
    const repository = new InscribedCardRepository(repo as unknown as Repository<InscribedCard>);

    await repository.findActiveBySession('session-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', status: CardStatus.Active },
    });
  });

  it('findById busca por id', async () => {
    const repo = mockRepo();
    const repository = new InscribedCardRepository(repo as unknown as Repository<InscribedCard>);

    await repository.findById('card-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'card-1' } });
  });

  it('findByIdAndSession busca por id validando la sesión dueña', async () => {
    const repo = mockRepo();
    const repository = new InscribedCardRepository(repo as unknown as Repository<InscribedCard>);

    await repository.findByIdAndSession('card-1', 'session-1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'card-1', sessionId: 'session-1' } });
  });

  it('create delega en el repo de TypeORM sin persistir', () => {
    const repo = mockRepo();
    const repository = new InscribedCardRepository(repo as unknown as Repository<InscribedCard>);

    repository.create({ sessionId: 'session-1' });

    expect(repo.create).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('save delega en el repo de TypeORM', async () => {
    const repo = mockRepo();
    const repository = new InscribedCardRepository(repo as unknown as Repository<InscribedCard>);
    const card = { id: 'card-1' } as InscribedCard;

    await repository.save(card);

    expect(repo.save).toHaveBeenCalledWith(card);
  });
});
