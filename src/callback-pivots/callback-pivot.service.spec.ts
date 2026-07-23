import { PIVOT_TTL_MINUTES } from '@/domain';

import { CallbackPivotRepository } from './repositories/callback-pivot.repository';
import { CallbackPivot } from './entities/callback-pivot.entity';
import { CallbackPivotService } from './callback-pivot.service';
import {
  PivotAlreadyConsumedException,
  PivotExpiredException,
  PivotNotFoundException,
} from './exceptions/pivot.exceptions';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}): CallbackPivotRepository {
  return {
    create: jest.fn((partial: Partial<CallbackPivot>) => partial as CallbackPivot),
    save: jest.fn(async (entity: unknown) => entity),
    findById: jest.fn(),
    ...overrides,
  } as unknown as CallbackPivotRepository;
}

describe('CallbackPivotService', () => {
  describe('create', () => {
    it('crea un pivot con expiresAt a PIVOT_TTL_MINUTES desde ahora', async () => {
      const repo = mockRepo();
      const service = new CallbackPivotService(repo);

      const before = Date.now();
      const pivot = await service.create({
        redirectPath: '/es/checkout/result',
        paymentAttemptId: 'attempt-1',
      });
      const after = Date.now();

      expect(pivot.redirectPath).toBe('/es/checkout/result');
      expect(pivot.paymentAttemptId).toBe('attempt-1');
      expect(pivot.expiresAt.getTime()).toBeGreaterThanOrEqual(before + PIVOT_TTL_MINUTES * 60_000);
      expect(pivot.expiresAt.getTime()).toBeLessThanOrEqual(after + PIVOT_TTL_MINUTES * 60_000);
      expect(pivot.enrollmentSessionId).toBeNull();
    });

    it('crea un pivot de inscripción (enrollmentSessionId) sin paymentAttemptId', async () => {
      const repo = mockRepo();
      const service = new CallbackPivotService(repo);

      const pivot = await service.create({
        redirectPath: '/es/cards',
        enrollmentSessionId: 'session-1',
      });

      expect(pivot.enrollmentSessionId).toBe('session-1');
      expect(pivot.paymentAttemptId).toBeNull();
    });
  });

  describe('attachExternalToken', () => {
    it('guarda el token externo en el pivot', async () => {
      const pivot = { id: 'pivot-1', externalToken: null } as CallbackPivot;
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(pivot) });
      const service = new CallbackPivotService(repo);

      await service.attachExternalToken('pivot-1', 'enroll-token');

      expect(pivot.externalToken).toBe('enroll-token');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ externalToken: 'enroll-token' }),
      );
    });

    it('lanza PivotNotFoundException si el pivot no existe', async () => {
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new CallbackPivotService(repo);

      await expect(service.attachExternalToken('missing', 'x')).rejects.toThrow(
        PivotNotFoundException,
      );
    });
  });

  describe('consume', () => {
    it('marca el pivot como consumido y lo retorna', async () => {
      const pivot = {
        id: 'pivot-1',
        paymentAttemptId: 'attempt-1',
        enrollmentSessionId: null,
        redirectPath: '/es/checkout/result',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
      } as CallbackPivot;
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(pivot) });
      const service = new CallbackPivotService(repo);

      const consumed = await service.consume('pivot-1');

      expect(consumed.consumedAt).not.toBeNull();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ consumedAt: expect.any(Date) }),
      );
    });

    it('lanza PivotNotFoundException si el pivot no existe', async () => {
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new CallbackPivotService(repo);

      await expect(service.consume('missing')).rejects.toThrow(PivotNotFoundException);
    });

    it('lanza PivotExpiredException si el pivot ya expiró', async () => {
      const pivot = {
        id: 'pivot-1',
        expiresAt: new Date(Date.now() - 1000),
        consumedAt: null,
      } as CallbackPivot;
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(pivot) });
      const service = new CallbackPivotService(repo);

      await expect(service.consume('pivot-1')).rejects.toThrow(PivotExpiredException);
    });

    it('lanza PivotAlreadyConsumedException si el pivot ya fue consumido (anti-replay)', async () => {
      const pivot = {
        id: 'pivot-1',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: new Date(),
      } as CallbackPivot;
      const repo = mockRepo({ findById: jest.fn().mockResolvedValue(pivot) });
      const service = new CallbackPivotService(repo);

      await expect(service.consume('pivot-1')).rejects.toThrow(PivotAlreadyConsumedException);
    });
  });
});
