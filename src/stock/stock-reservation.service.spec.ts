import { ReservationStatus, RESERVATION_TTL_MINUTES } from '@/domain';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { InsufficientStockException } from './insufficient-stock.exception';
import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { StockReservationService } from './stock-reservation.service';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockReservationRepository } from './repositories/stock-reservation.repository';

/**
 * `lockManyForUpdate`/`saveWithManager` de `ProductRepository`, y todos los
 * métodos de `StockReservationRepository`, operan exclusivamente sobre el
 * `EntityManager` que reciben como parámetro, nunca sobre el repo "suelto"
 * inyectado por constructor. Por eso basta con instancias reales (no mocks)
 * aquí: el `EntityManager` simulado abajo es lo único que necesita comportarse.
 */
function buildProductRepository(): ProductRepository {
  return new ProductRepository(undefined as unknown as Repository<Product>);
}

function buildStockReservationRepository(): StockReservationRepository {
  return new StockReservationRepository();
}

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Producto',
    description: 'x',
    priceClp: 1000,
    stockTotal: 10,
    stockReserved: 0,
    imageUrl: null,
    isSeed: true,
    createdBySessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Product;
}

/** Mock encadenable de QueryBuilder que resuelve `getMany()` con `products`. */
function buildQueryBuilder(products: Product[]) {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(products),
  };
  return qb;
}

describe('StockReservationService', () => {
  function buildManager(products: Product[]) {
    const qb = buildQueryBuilder(products);
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
      find: jest.fn(),
      __qb: qb,
    };
    return manager as unknown as EntityManager & { __qb: ReturnType<typeof buildQueryBuilder> };
  }

  function buildDataSource(manager: EntityManager) {
    return {
      transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    } as unknown as DataSource;
  }

  function buildGateway(): DomainEventPublisher {
    return { stockChanged: jest.fn() } as unknown as DomainEventPublisher;
  }

  describe('reserveAtomic', () => {
    it('crea una reserva Active por producto cuando hay stock suficiente', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 2 });
      const manager = buildManager([product]);
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      const reservations = await service.reserveAtomic('order-1', [
        { productId: 'p1', quantity: 3 },
      ]);

      expect(reservations).toHaveLength(1);
      expect(reservations[0]).toMatchObject({
        orderId: 'order-1',
        productId: 'p1',
        quantity: 3,
        status: ReservationStatus.Active,
      });
      expect(product.stockReserved).toBe(5);
    });

    it('setea expiresAt a RESERVATION_TTL_MINUTES desde ahora', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 0 });
      const manager = buildManager([product]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      const before = Date.now();
      const [reservation] = await service.reserveAtomic('order-1', [
        { productId: 'p1', quantity: 1 },
      ]);
      const after = Date.now();

      const expectedMinMs = before + RESERVATION_TTL_MINUTES * 60_000;
      const expectedMaxMs = after + RESERVATION_TTL_MINUTES * 60_000;
      expect(reservation.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinMs);
      expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxMs);
    });

    it('reserva múltiples productos en una sola transacción', async () => {
      const productA = buildProduct({ id: 'pA', stockTotal: 5, stockReserved: 0 });
      const productB = buildProduct({ id: 'pB', stockTotal: 5, stockReserved: 0 });
      const manager = buildManager([productA, productB]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      const reservations = await service.reserveAtomic('order-1', [
        { productId: 'pA', quantity: 2 },
        { productId: 'pB', quantity: 1 },
      ]);

      expect(reservations).toHaveLength(2);
      expect(productA.stockReserved).toBe(2);
      expect(productB.stockReserved).toBe(1);
    });

    it('bloquea los productos ordenados por id ascendente (anti-deadlock)', async () => {
      const productA = buildProduct({ id: 'pA' });
      const productB = buildProduct({ id: 'pB' });
      const manager = buildManager([productA, productB]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      // Se piden en orden inverso (pB antes que pA) a propósito.
      await service.reserveAtomic('order-1', [
        { productId: 'pB', quantity: 1 },
        { productId: 'pA', quantity: 1 },
      ]);

      expect(manager.__qb.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
        ids: ['pA', 'pB'],
      });
      expect(manager.__qb.orderBy).toHaveBeenCalledWith('product.id', 'ASC');
      expect(manager.__qb.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('lanza InsufficientStockException y no reserva nada si un producto no alcanza', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 5, stockReserved: 4 });
      const manager = buildManager([product]);
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await expect(
        service.reserveAtomic('order-1', [{ productId: 'p1', quantity: 3 }]),
      ).rejects.toThrow(InsufficientStockException);

      expect(manager.save).not.toHaveBeenCalled();
      expect(gateway.stockChanged).not.toHaveBeenCalled();
      expect(product.stockReserved).toBe(4);
    });

    it('lanza InsufficientStockException si el producto solicitado ya no existe (0 disponible)', async () => {
      const manager = buildManager([]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      await expect(
        service.reserveAtomic('order-1', [{ productId: 'p-eliminado', quantity: 1 }]),
      ).rejects.toThrow(InsufficientStockException);
    });

    it('el caso límite: 1 unidad disponible y se piden 2 falla completo (nada queda parcialmente reservado)', async () => {
      const productA = buildProduct({ id: 'pA', stockTotal: 5, stockReserved: 0 });
      const productB = buildProduct({ id: 'pB', stockTotal: 1, stockReserved: 0 });
      const manager = buildManager([productA, productB]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      await expect(
        service.reserveAtomic('order-1', [
          { productId: 'pA', quantity: 2 },
          { productId: 'pB', quantity: 2 },
        ]),
      ).rejects.toThrow(InsufficientStockException);

      expect(productA.stockReserved).toBe(0);
    });

    it('emite stock.changed por producto después de comprometer la transacción', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 0 });
      const manager = buildManager([product]);
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.reserveAtomic('order-1', [{ productId: 'p1', quantity: 4 }]);

      expect(gateway.stockChanged).toHaveBeenCalledWith('p1', 6);
    });
  });

  describe('reserveAtomicWith', () => {
    it('reserva usando el manager externo y NO emite (el llamador emite tras el commit)', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 0 });
      const manager = buildManager([product]);
      const gateway = buildGateway();
      const service = new StockReservationService(
        buildDataSource(manager),
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      const { reservations, touchedProducts } = await service.reserveAtomicWith(
        manager,
        'order-1',
        [{ productId: 'p1', quantity: 3 }],
      );

      expect(reservations).toHaveLength(1);
      expect(touchedProducts).toEqual([product]);
      expect(product.stockReserved).toBe(3);
      expect(gateway.stockChanged).not.toHaveBeenCalled();
    });
  });

  describe('emitAvailabilityFor', () => {
    it('emite stock.changed (disponible = total − reservado) por cada producto', () => {
      const product = buildProduct({ id: 'pA', stockTotal: 10, stockReserved: 4 });
      const gateway = buildGateway();
      const service = new StockReservationService(
        buildDataSource(buildManager([])),
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      service.emitAvailabilityFor([product]);

      expect(gateway.stockChanged).toHaveBeenCalledWith('pA', 6);
    });
  });

  describe('release', () => {
    it('libera las reservas Active de una orden y devuelve el stock', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 3 });
      const reservation = {
        id: 'r1',
        orderId: 'order-1',
        productId: 'p1',
        quantity: 3,
        status: ReservationStatus.Active,
        expiresAt: new Date(),
        createdAt: new Date(),
        releasedAt: null,
      } as StockReservation;

      const qbProducts = buildQueryBuilder([product]);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbProducts),
        find: jest.fn().mockResolvedValue([reservation]),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.release('order-1');

      expect(product.stockReserved).toBe(0);
      expect(reservation.status).toBe(ReservationStatus.Released);
      expect(reservation.releasedAt).not.toBeNull();
      expect(gateway.stockChanged).toHaveBeenCalledWith('p1', 10);
    });

    it('no hace nada si la orden no tiene reservas activas', async () => {
      const manager = {
        createQueryBuilder: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.release('order-sin-reservas');

      expect(manager.save).not.toHaveBeenCalled();
      expect(gateway.stockChanged).not.toHaveBeenCalled();
    });

    it('libera reservas de varios productos distintos ordenados por id (anti-deadlock)', async () => {
      const productA = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 2 });
      const productB = buildProduct({ id: 'p2', stockTotal: 5, stockReserved: 1 });
      const reservations = [
        {
          id: 'r1',
          orderId: 'order-1',
          productId: 'p2',
          quantity: 1,
          status: ReservationStatus.Active,
        } as StockReservation,
        {
          id: 'r2',
          orderId: 'order-1',
          productId: 'p1',
          quantity: 2,
          status: ReservationStatus.Active,
        } as StockReservation,
      ];
      const qbProducts = buildQueryBuilder([productA, productB]);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbProducts),
        find: jest.fn().mockResolvedValue(reservations),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.release('order-1');

      expect(qbProducts.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
        ids: ['p1', 'p2'],
      });
      expect(productA.stockReserved).toBe(0);
      expect(productB.stockReserved).toBe(0);
    });
  });

  describe('consume', () => {
    it('consume las reservas Active de una orden pagada (baja stockTotal y stockReserved)', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 3 });
      const reservation = {
        id: 'r1',
        orderId: 'order-1',
        productId: 'p1',
        quantity: 3,
        status: ReservationStatus.Active,
        expiresAt: new Date(),
        createdAt: new Date(),
        releasedAt: null,
      } as StockReservation;

      const qbProducts = buildQueryBuilder([product]);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbProducts),
        find: jest.fn().mockResolvedValue([reservation]),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.consume('order-1');

      expect(product.stockTotal).toBe(7);
      expect(product.stockReserved).toBe(0);
      expect(reservation.status).toBe(ReservationStatus.Consumed);
      expect(gateway.stockChanged).toHaveBeenCalledWith('p1', 7);
    });
  });

  describe('expireDueReservations', () => {
    it('expira las reservas Active vencidas y libera su stock', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 2 });
      const reservation = {
        id: 'r1',
        orderId: 'order-1',
        productId: 'p1',
        quantity: 2,
        status: ReservationStatus.Active,
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
        releasedAt: null,
      } as StockReservation;

      const qbProducts = buildQueryBuilder([product]);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbProducts),
        find: jest.fn().mockResolvedValue([reservation]),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      const expiredCount = await service.expireDueReservations();

      expect(expiredCount).toBe(1);
      expect(reservation.status).toBe(ReservationStatus.Expired);
      expect(product.stockReserved).toBe(0);
      expect(gateway.stockChanged).toHaveBeenCalled();
    });

    it('expira reservas vencidas de varios productos distintos ordenados por id', async () => {
      const productA = buildProduct({ id: 'p1', stockTotal: 10, stockReserved: 2 });
      const productB = buildProduct({ id: 'p2', stockTotal: 5, stockReserved: 1 });
      const reservations = [
        {
          id: 'r1',
          orderId: 'order-1',
          productId: 'p2',
          quantity: 1,
          status: ReservationStatus.Active,
          expiresAt: new Date(Date.now() - 1000),
        } as StockReservation,
        {
          id: 'r2',
          orderId: 'order-2',
          productId: 'p1',
          quantity: 2,
          status: ReservationStatus.Active,
          expiresAt: new Date(Date.now() - 1000),
        } as StockReservation,
      ];
      const qbProducts = buildQueryBuilder([productA, productB]);
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qbProducts),
        find: jest.fn().mockResolvedValue(reservations),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      const expiredCount = await service.expireDueReservations();

      expect(expiredCount).toBe(2);
      expect(qbProducts.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
        ids: ['p1', 'p2'],
      });
    });

    it('retorna 0 sin tocar nada si no hay reservas vencidas', async () => {
      const manager = {
        createQueryBuilder: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn(),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      const expiredCount = await service.expireDueReservations();

      expect(expiredCount).toBe(0);
      expect(gateway.stockChanged).not.toHaveBeenCalled();
    });
  });

  describe('restoreConsumed', () => {
    it('devuelve a stockTotal las unidades de un refund (no toca stockReserved)', async () => {
      const product = buildProduct({ id: 'p1', stockTotal: 7, stockReserved: 0 });
      const manager = buildManager([product]);
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.restoreConsumed([{ productId: 'p1', quantity: 3 }]);

      expect(product.stockTotal).toBe(10);
      expect(product.stockReserved).toBe(0);
      expect(gateway.stockChanged).toHaveBeenCalledWith('p1', 10);
    });

    it('restaura varios productos ordenados por id (anti-deadlock)', async () => {
      const productA = buildProduct({ id: 'pA', stockTotal: 5 });
      const productB = buildProduct({ id: 'pB', stockTotal: 2 });
      const manager = buildManager([productA, productB]);
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      await service.restoreConsumed([
        { productId: 'pB', quantity: 1 },
        { productId: 'pA', quantity: 2 },
      ]);

      expect(manager.__qb.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
        ids: ['pA', 'pB'],
      });
      expect(productA.stockTotal).toBe(7);
      expect(productB.stockTotal).toBe(3);
    });

    it('no hace nada si la lista de items está vacía', async () => {
      const manager = {
        createQueryBuilder: jest.fn(),
        save: jest.fn(),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const gateway = buildGateway();
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        gateway,
      );

      await service.restoreConsumed([]);

      expect(manager.save).not.toHaveBeenCalled();
      expect(gateway.stockChanged).not.toHaveBeenCalled();
    });
  });

  describe('extendExpiry', () => {
    it('empuja expiresAt de las reservas activas de la orden hacia adelante', async () => {
      const reservation = {
        id: 'r1',
        orderId: 'order-1',
        productId: 'p1',
        quantity: 1,
        status: ReservationStatus.Active,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        releasedAt: null,
      } as StockReservation;
      const manager = {
        find: jest.fn().mockResolvedValue([reservation]),
        save: jest.fn(async (_entity: unknown, value: unknown) => value),
      } as unknown as EntityManager;
      const dataSource = buildDataSource(manager);
      const service = new StockReservationService(
        dataSource,
        buildProductRepository(),
        buildStockReservationRepository(),
        buildGateway(),
      );

      const originalExpiry = reservation.expiresAt.getTime();
      await service.extendExpiry('order-1', 5);

      expect(reservation.expiresAt.getTime()).toBeGreaterThan(originalExpiry);
    });
  });
});
