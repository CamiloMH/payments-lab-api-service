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
import { CallbackPivot } from '@/callback-pivots/entities/callback-pivot.entity';
import { InscribedCard } from '@/cards/entities/inscribed-card.entity';
import { CartItem } from '@/cart/entities/cart-item.entity';
import { Cart } from '@/cart/entities/cart.entity';
import { OrderEvent } from '@/order-events/entities/order-event.entity';
import { OrderItem } from '@/orders/entities/order-item.entity';
import { Order } from '@/orders/entities/order.entity';
import { PaymentTrace } from '@/payment-traces/entities/payment-trace.entity';
import { PaymentAttempt } from '@/payments/entities/payment-attempt.entity';
import { DemoSession } from '@/session/entities/demo-session.entity';

config({ path: '.env' });

/**
 * Prueba el caso crítico del diseño contra Postgres real (requiere
 * `docker compose up -d` levantado): con 1 unidad de stock, 2 reservas
 * concurrentes por la misma cantidad deben resolver en exactamente un
 * ganador; el lock pesimista (`SELECT ... FOR UPDATE`, estándar SQL que
 * TypeORM emite igual en Postgres que en MySQL) serializa la segunda
 * transacción, que ve el stock ya consumido y falla con
 * `InsufficientStockException`.
 */
describe('Reserva de stock: concurrencia (e2e)', () => {
  let dataSource: DataSource;
  let service: StockReservationService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'payments',
      password: process.env.DB_PASSWORD ?? 'payments_pass',
      database: process.env.DB_NAME ?? 'payments_lab',
      // El dominio es un solo grafo de relaciones conectado (Product -> DemoSession
      // -> Cart/Order/InscribedCard -> ...): TypeORM necesita resolver ambos lados
      // de cada relación al construir los metadatos, aunque este test solo consulte
      // Product y StockReservation. Se listan todas las entidades, igual que hace
      // el DataSource de producción (`data-source.ts`) vía su glob.
      entities: [
        Product,
        StockReservation,
        DemoSession,
        Cart,
        CartItem,
        Order,
        OrderItem,
        OrderEvent,
        InscribedCard,
        PaymentAttempt,
        PaymentTrace,
        CallbackPivot,
      ],
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

  /**
   * `stock_reservations.order_id` tiene FK real contra `orders.id` (y esta,
   * a su vez, contra `demo_sessions.id`): antes de reservar hace falta una
   * orden real, no solo un string arbitrario como id.
   */
  async function createOrder(id: string): Promise<void> {
    // Mismo string para sesión y orden: no hay relación entre ambos ids más
    // allá de que esta orden le pertenece, y `demo_sessions.id` es varchar(21)
    // igual que `orders.id`, así que reusarlo evita pisar ese límite.
    const session = await dataSource
      .getRepository(DemoSession)
      .save(dataSource.getRepository(DemoSession).create({ id }));

    await dataSource.getRepository(Order).save(
      dataSource.getRepository(Order).create({
        id,
        buyOrder: id,
        sessionId: session.id,
        totalClp: 1000,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
  }

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

    await createOrder('order-e2e-a');
    await createOrder('order-e2e-b');

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

    await createOrder('order-e2e-release');
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
