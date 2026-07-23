import { DemoSession } from './entities/demo-session.entity';
import { DemoSessionRepository } from './repositories/demo-session.repository';
import { SessionService } from './session.service';

type MockSessionRepository = {
  findById: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

describe('SessionService', () => {
  function buildRepository(overrides: Partial<MockSessionRepository> = {}): DemoSessionRepository {
    const mock: MockSessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      create: jest.fn((partial: Partial<DemoSession>) => partial as DemoSession),
      ...overrides,
    };
    return mock as unknown as DemoSessionRepository;
  }

  describe('findOrCreate', () => {
    it('crea una sesión nueva si no se pasa id', async () => {
      const repository = buildRepository({
        save: jest.fn(async (s) => ({ ...s, id: 'new-id' }) as DemoSession),
      });
      const service = new SessionService(repository);

      const session = await service.findOrCreate(undefined);

      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(session.id).toBe('new-id');
    });

    it('reutiliza la sesión existente y refresca lastSeenAt', async () => {
      const existing = { id: 'existing-id', lastSeenAt: new Date(0) } as DemoSession;
      const repository = buildRepository({
        findById: jest.fn().mockResolvedValue(existing),
        save: jest.fn(async (s) => s as DemoSession),
      });
      const service = new SessionService(repository);

      const session = await service.findOrCreate('existing-id');

      expect(repository.findById).toHaveBeenCalledWith('existing-id');
      expect(repository.save).toHaveBeenCalledWith(existing);
      expect(session.id).toBe('existing-id');
    });

    it('crea una sesión nueva si el id de la cookie no existe en la BD', async () => {
      const repository = buildRepository({
        findById: jest.fn().mockResolvedValue(null),
        save: jest.fn(async (s) => ({ ...s, id: 'fresh-id' }) as DemoSession),
      });
      const service = new SessionService(repository);

      const session = await service.findOrCreate('stale-cookie-id');

      expect(session.id).toBe('fresh-id');
    });
  });
});
