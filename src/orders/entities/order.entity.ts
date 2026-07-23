import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { OrderStatus } from '@/domain';

import { ORDER_NUMBER_LENGTH, generateId, generateOrderNumber } from '../../common/nanoid';
import { decimalTransformer } from '../../database/transformers/decimal.transformer';
import { PaymentAttempt } from '../../payments/entities/payment-attempt.entity';
import { PaymentTrace } from '../../payment-traces/entities/payment-trace.entity';
import { DemoSession } from '../../session/entities/demo-session.entity';
import { StockReservation } from '../../stock/entities/stock-reservation.entity';
import { OrderEvent } from '../../order-events/entities/order-event.entity';
import { OrderItem } from './order-item.entity';

/**
 * Orden de compra. `buyOrder` es el identificador enviado a Transbank como
 * `buyOrder` padre (prefijo `PL-` + este id de 21 chars = 24 ≤ 26 máx SDK).
 */
@Entity('orders')
export class Order {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Identificador enviado a Transbank como `buyOrder` padre: prefijo `PL-` + `id`. */
  @Column({ name: 'buy_order', type: 'varchar', length: 26, unique: true })
  buyOrder!: string;

  /**
   * Número de orden legible que se muestra al usuario. Aleatorio (no correlativo)
   * para no revelar el orden ni el volumen de compras. Nullable solo para admitir
   * las órdenes creadas antes de introducir esta columna; en las nuevas siempre se
   * asigna en `assignId()`.
   */
  @Column({ name: 'order_number', type: 'varchar', length: ORDER_NUMBER_LENGTH, nullable: true })
  orderNumber!: string | null;

  /** Sesión anónima dueña de la orden. */
  @Column({ name: 'session_id', type: 'varchar', length: 21 })
  sessionId!: string;

  @ManyToOne(() => DemoSession, (session) => session.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Relation<DemoSession>;

  /** Estado actual en la máquina de estados de la orden (`domain/machines/order-state.machine.ts`). */
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PendingPayment })
  status!: OrderStatus;

  /** Monto total de la orden en pesos chilenos (CLP). */
  @Column({
    name: 'total_clp',
    type: 'decimal',
    precision: 12,
    scale: 0,
    transformer: decimalTransformer,
  })
  totalClp!: number;

  /** Vencimiento de la reserva de stock asociada mientras la orden esté `pending_payment`. */
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  /** Líneas de la orden: snapshot de productos comprados (nombre y precio no cambian si el producto se edita después). */
  @OneToMany(() => OrderItem, (item) => item.order)
  items!: OrderItem[];

  /** Intentos de pago abiertos para esta orden (uno por checkout/retry). */
  @OneToMany(() => PaymentAttempt, (attempt) => attempt.order)
  paymentAttempts!: PaymentAttempt[];

  /** Entradas del audit log (timeline) de la orden. */
  @OneToMany(() => OrderEvent, (event) => event.order)
  events!: OrderEvent[];

  /** Trazas de interacción con los PSP asociadas a la orden. */
  @OneToMany(() => PaymentTrace, (trace) => trace.order)
  traces!: PaymentTrace[];

  /** Reservas de stock asociadas a la orden. */
  @OneToMany(() => StockReservation, (reservation) => reservation.order)
  reservations!: StockReservation[];

  /** Fecha de creación de la orden. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Fecha de la última transición de estado. */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
    this.buyOrder ??= `PL-${this.id}`;
    this.orderNumber ??= generateOrderNumber();
  }
}
