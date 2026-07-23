import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import type { DomainEventPublisher } from '@/common/events/domain-event.publisher';
import { InsufficientStockException } from '@/stock/insufficient-stock.exception';
import { StockReservation } from '@/stock/entities/stock-reservation.entity';
import { StockReservationRepository } from '@/stock/repositories/stock-reservation.repository';
import { StockReservationService } from '@/stock/stock-reservation.service';
import { Product } from '@/products/entities/product.entity';
import { ProductRepository } from '@/products/repositories/product.repository';

config({ path: '.env' });

/**
 * Prueba el caso crítico del diseño contra MariaDB real (requiere
 * `docker compose up -d` levantado): con 1 unidad de stock, 2 reservas
 * concurrentes por la misma cantidad deben resolver en exactamente un
 * ganador; el lock pesimista serializa la segunda transacción, que ve el
 * stock ya consumido y falla con `InsufficientStockException`.
 */
describe('Reserva de stock: concurrencia (e2e)', () => {
  let dataSource: DataSource;
  let service: StockReservationService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mariadb',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3309),
      username: process.env.DB_USER ?? 'payments',
      password: process.env.DB_PASSWORD ?? 'payments_pass',
      database: process.env.DB_NAME ?? 'payments_lab',
      entities: [Product, StockReservation],
      synchronize: false,
    });
    await dataSource.initialize();

    const fakeEvents = { stockChanged: jest.fn() } as unknown as DomainEventPublisher;
    const productRepository = new ProductRepository(dataSource.getRepository(Product));
    const stockReservationRepository = new StockReservationRepository();
    service = new StockReservationService(
      dataSource,
      productRepository,
      stockReservationRepository,
      fakeEvents,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('solo una de dos reservas concurrentes gana la última unidad disponible', async () => {
    const product = await dataSource.getRepository(Product).save(
      dataSource.getRepository(Product).create({
        name: 'Producto e2e concurrencia',
        description: 'Producto efímero creado por el test de concurrencia',
        priceClp: 1000,
        stockTotal: 1,
        stockReserved: 0,
        isSeed: false,
      }),
    );

    const results = await Promise.allSettled([
      service.reserveAtomic('order-e2e-a', [{ productId: product.id, quantity: 1 }]),
      service.reserveAtomic('order-e2e-b', [{ productId: product.id, quantity: 1 }]),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientStockException,
    );

    const finalProduct = await dataSource.getRepository(Product).findOneOrFail({
      where: { id: product.id },
    });
    expect(finalProduct.stockReserved).toBe(1);

    const reservations = await dataSource
      .getRepository(StockReservation)
      .find({ where: { productId: product.id } });
    expect(reservations).toHaveLength(1);
  });

  it('libera la reserva perdedora al cancelar y el stock vuelve a estar disponible', async () => {
    const product = await dataSource.getRepository(Product).save(
      dataSource.getRepository(Product).create({
        name: 'Producto e2e release',
        description: 'Producto efímero creado por el test de release',
        priceClp: 500,
        stockTotal: 3,
        stockReserved: 0,
        isSeed: false,
      }),
    );

    await service.reserveAtomic('order-e2e-release', [{ productId: product.id, quantity: 2 }]);
    let current = await dataSource
      .getRepository(Product)
      .findOneOrFail({ where: { id: product.id } });
    expect(current.stockTotal - current.stockReserved).toBe(1);

    await service.release('order-e2e-release');

    current = await dataSource.getRepository(Product).findOneOrFail({ where: { id: product.id } });
    expect(current.stockTotal - current.stockReserved).toBe(3);
  });
});
