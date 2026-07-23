import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ReservationStatus, RESERVATION_TTL_MINUTES } from '@/domain';
import type { DataSource, EntityManager } from 'typeorm';

import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { InsufficientStockException } from './insufficient-stock.exception';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockReservationRepository } from './repositories/stock-reservation.repository';
import { formatLogFields } from '../common/logging/format-log-fields';

/** Ítem a reservar: producto + cantidad solicitada. */
export interface ReservationItem {
  productId: string;
  quantity: number;
}

/**
 * Núcleo de negocio de la demo: reserva stock de forma atómica bajo lock
 * pesimista, con TTL y liberación/consumo/expiración simétricos. Todas las
 * mutaciones de `stockReserved`/`stockTotal` pasan por aquí; ningún otro
 * servicio debe tocar esas columnas directamente.
 *
 * Los `for...of` con `await` de este archivo son intencionalmente
 * secuenciales, no `Promise.all`: todas las queries dentro de un método
 * comparten el mismo `manager`/conexión de la transacción, que no admite
 * queries concurrentes, y el orden (productos bloqueados por id ascendente)
 * es lo que previene deadlocks entre reservas simultáneas.
 */
@Injectable()
export class StockReservationService {
  private readonly logger = new Logger(StockReservationService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly products: ProductRepository,
    private readonly reservations: StockReservationRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  /**
   * Reserva `items` completos o ninguno en una transacción propia y emite la
   * disponibilidad al comprometer. Envoltorio de `reserveAtomicWith` para los
   * llamadores que no comparten una transacción externa.
   */
  async reserveAtomic(orderId: string, items: ReservationItem[]): Promise<StockReservation[]> {
    const { reservations, touchedProducts } = await this.dataSource.transaction((manager) =>
      this.reserveAtomicWith(manager, orderId, items),
    );

    this.emitAvailabilityFor(touchedProducts);
    return reservations;
  }

  /**
   * Igual que `reserveAtomic` pero participa en una transacción externa (la del
   * checkout, que primero persiste la orden para satisfacer la FK
   * `stock_reservations → orders`). No emite eventos: el llamador debe invocar
   * `emitAvailabilityFor` con los `touchedProducts` una vez comprometida la
   * transacción. Bloquea los productos ordenados por id ascendente (previene
   * deadlocks entre reservas concurrentes) y rechaza la operación entera si
   * algún producto no tiene disponibilidad suficiente.
   */
  async reserveAtomicWith(
    manager: EntityManager,
    orderId: string,
    items: ReservationItem[],
  ): Promise<{ reservations: StockReservation[]; touchedProducts: Product[] }> {
    this.logger.log(formatLogFields({ orderId, items: items.length }));
    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    const productIds = sortedItems.map((item) => item.productId);

    const products = await this.products.lockManyForUpdate(productIds, manager);
    const byId = new Map(products.map((product) => [product.id, product]));

    const shortfalls = sortedItems
      .map((item) => {
        const product = byId.get(item.productId);
        const available = product ? product.stockTotal - product.stockReserved : 0;
        return { item, available };
      })
      .filter(({ item, available }) => available < item.quantity)
      .map(({ item, available }) => ({
        productId: item.productId,
        requested: item.quantity,
        available,
      }));

    if (shortfalls.length > 0) {
      this.logger.warn(formatLogFields({ orderId, shortfalls: JSON.stringify(shortfalls) }));
      throw new InsufficientStockException(shortfalls);
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000);
    const created: StockReservation[] = [];

    for (const item of sortedItems) {
      const product = byId.get(item.productId)!;
      product.stockReserved += item.quantity;
      await this.products.saveWithManager(product, manager);

      const reservation = new StockReservation();
      reservation.orderId = orderId;
      reservation.productId = item.productId;
      reservation.quantity = item.quantity;
      reservation.status = ReservationStatus.Active;
      reservation.expiresAt = expiresAt;
      created.push(await this.reservations.saveWithManager(reservation, manager));
    }

    this.logger.log(formatLogFields({ orderId, cantidad: created.length }));
    return { reservations: created, touchedProducts: products };
  }

  /** Emite `stock.changed` por cada producto tocado. Debe llamarse tras comprometer la transacción. */
  emitAvailabilityFor(products: Product[]): void {
    products.forEach((product) => this.emitAvailability(product));
  }

  /** Libera todas las reservas Active de una orden (cancelación o fallo del pago). */
  async release(orderId: string): Promise<void> {
    this.logger.log(formatLogFields({ orderId }));
    await this.resolveReservations(orderId, ReservationStatus.Released);
  }

  /** Consume definitivamente las reservas Active de una orden pagada. */
  async consume(orderId: string): Promise<void> {
    this.logger.log(formatLogFields({ orderId }));
    await this.resolveReservations(orderId, ReservationStatus.Consumed);
  }

  /**
   * Expira las reservas Active cuyo `expiresAt` ya venció. Usado por el
   * sweep periódico (`StockSweepService`); retorna cuántas reservas expiró.
   */
  async expireDueReservations(): Promise<number> {
    const { expiredCount, touchedProducts } = await this.dataSource.transaction(async (manager) => {
      const due = await this.reservations.findAllActive(manager);
      const expired = due.filter((reservation) => reservation.expiresAt.getTime() < Date.now());
      if (expired.length === 0) return { expiredCount: 0, touchedProducts: [] as Product[] };

      const productIds = [...new Set(expired.map((r) => r.productId))].sort((a, b) =>
        a.localeCompare(b),
      );
      const products = await this.products.lockManyForUpdate(productIds, manager);
      const byId = new Map(products.map((product) => [product.id, product]));

      for (const reservation of expired) {
        const product = byId.get(reservation.productId)!;
        product.stockReserved -= reservation.quantity;
        await this.products.saveWithManager(product, manager);

        reservation.status = ReservationStatus.Expired;
        reservation.releasedAt = new Date();
        await this.reservations.saveWithManager(reservation, manager);
      }

      return { expiredCount: expired.length, touchedProducts: products };
    });

    touchedProducts.forEach((product) => this.emitAvailability(product));
    return expiredCount;
  }

  /**
   * Devuelve a `stockTotal` las unidades que un `consume()` había descontado
   * permanentemente. Uso: una devolución (`refund`) sobre una orden `Paid`;
   * las reservas originales ya están `Consumed` (no `Active`), así que no se
   * tocan; solo se restituye la disponibilidad de venta.
   */
  async restoreConsumed(items: ReservationItem[]): Promise<void> {
    if (items.length === 0) return;
    this.logger.log(formatLogFields({ cantidad: items.length }));
    const sortedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    const productIds = sortedItems.map((item) => item.productId);

    const touchedProducts = await this.dataSource.transaction(async (manager) => {
      const products = await this.products.lockManyForUpdate(productIds, manager);
      const byId = new Map(products.map((product) => [product.id, product]));

      for (const item of sortedItems) {
        const product = byId.get(item.productId);
        if (!product) continue;
        product.stockTotal += item.quantity;
        await this.products.saveWithManager(product, manager);
      }

      return products;
    });

    touchedProducts.forEach((product) => this.emitAvailability(product));
  }

  /**
   * Empuja `expiresAt` de las reservas Active de una orden `extraMinutes`
   * hacia adelante. Se usa cuando un intento de pago pasa a `Redirected`
   * (pago "en vuelo"), para que el sweep no libere el stock mientras el
   * usuario sigue en el formulario del PSP.
   */
  async extendExpiry(orderId: string, extraMinutes: number): Promise<void> {
    this.logger.log(formatLogFields({ orderId, extraMinutes }));
    await this.dataSource.transaction(async (manager) => {
      const reservations = await this.reservations.findActiveByOrderId(orderId, manager);
      for (const reservation of reservations) {
        reservation.expiresAt = new Date(reservation.expiresAt.getTime() + extraMinutes * 60_000);
        await this.reservations.saveWithManager(reservation, manager);
      }
    });
  }

  /** Plantilla compartida por `release`/`consume`: lock + mutar contador + emitir post-commit. */
  private async resolveReservations(
    orderId: string,
    targetStatus: ReservationStatus.Released | ReservationStatus.Consumed,
  ): Promise<void> {
    const touchedProducts = await this.dataSource.transaction(async (manager) => {
      const reservations = await this.reservations.findActiveByOrderId(orderId, manager);
      if (reservations.length === 0) return [] as Product[];

      const productIds = [...new Set(reservations.map((r) => r.productId))].sort((a, b) =>
        a.localeCompare(b),
      );
      const products = await this.products.lockManyForUpdate(productIds, manager);
      const byId = new Map(products.map((product) => [product.id, product]));

      for (const reservation of reservations) {
        const product = byId.get(reservation.productId)!;
        product.stockReserved -= reservation.quantity;
        if (targetStatus === ReservationStatus.Consumed) {
          product.stockTotal -= reservation.quantity;
        }
        await this.products.saveWithManager(product, manager);

        reservation.status = targetStatus;
        reservation.releasedAt = new Date();
        await this.reservations.saveWithManager(reservation, manager);
      }

      return products;
    });

    touchedProducts.forEach((product) => this.emitAvailability(product));
  }

  private emitAvailability(product: Product): void {
    this.events.stockChanged(product.id, product.stockTotal - product.stockReserved);
  }
}
