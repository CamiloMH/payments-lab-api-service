import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';

import { ReservationStatus } from '@/domain';

import { generateId } from '../../common/nanoid';
import { Order } from '../../orders/entities/order.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Reserva de `quantity` unidades de un producto para una orden, con TTL. Una
 * fila por (orden, producto). El índice en `expiresAt` es el que usa el sweep
 * (`StockSweepService`) para encontrar reservas vencidas eficientemente.
 */
@Entity('stock_reservations')
export class StockReservation {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 21 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.reservations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @Column({ name: 'product_id', type: 'varchar', length: 21 })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  /** Estado de la reserva: activa, consumida (orden pagada), liberada (cancelación/fallo) o expirada (TTL). */
  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.Active })
  status!: ReservationStatus;

  /** Vencimiento de la reserva; el `StockSweepService` usa el índice para encontrar reservas vencidas eficientemente. */
  @Index()
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Fecha en que la reserva pasó a `consumed`/`released`/`expired`; `null` mientras sigue `active`. */
  @Column({ name: 'released_at', type: 'datetime', nullable: true })
  releasedAt!: Date | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
