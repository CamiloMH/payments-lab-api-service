import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';

import { OrderEventRepository } from './repositories/order-event.repository';
import { OrderEventService } from './order-event.service';

function buildRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    save: jest.fn(async (event: unknown) => event),
    findByOrder: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('OrderEventService', () => {
  it('record persiste un evento mínimo (sin campos opcionales) con nulls explícitos', async () => {
    const repo = buildRepo();
    const service = new OrderEventService(repo as unknown as OrderEventRepository);

    const event = await service.record('order-1', OrderEventType.OrderCreated);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        type: OrderEventType.OrderCreated,
        fromStatus: null,
        toStatus: null,
        provider: null,
        attemptId: null,
        detail: null,
      }),
    );
    expect(event).toMatchObject({ orderId: 'order-1', type: OrderEventType.OrderCreated });
  });

  it('record persiste los campos opcionales cuando se proveen', async () => {
    const repo = buildRepo();
    const service = new OrderEventService(repo as unknown as OrderEventRepository);

    await service.record('order-1', OrderEventType.OrderPaid, {
      fromStatus: OrderStatus.PendingPayment,
      toStatus: OrderStatus.Paid,
      provider: PaymentProviderId.TransbankWebpayPlus,
      attemptId: 'attempt-1',
      detail: 'Confirmado por Transbank',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: OrderStatus.PendingPayment,
        toStatus: OrderStatus.Paid,
        provider: PaymentProviderId.TransbankWebpayPlus,
        attemptId: 'attempt-1',
        detail: 'Confirmado por Transbank',
      }),
    );
  });

  it('listByOrder delega en el repositorio', async () => {
    const repo = buildRepo();
    const service = new OrderEventService(repo as unknown as OrderEventRepository);

    await service.listByOrder('order-1');

    expect(repo.findByOrder).toHaveBeenCalledWith('order-1');
  });
});
