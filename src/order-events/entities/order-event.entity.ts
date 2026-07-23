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

import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';

import { generateId } from '../../common/nanoid';
import { Order } from '../../orders/entities/order.entity';

/**
 * Entrada del audit log de una orden: una fila por cada transición relevante
 * de su ciclo de vida (creación, intento de pago, confirmación, cancelación,
 * expiración, devolución…). Es la fuente del timeline que ve el cliente en
 * `GET /orders/:id/timeline`. `detail` es texto de auditoría controlado por
 * el dominio, NUNCA el payload/token crudo de un PSP.
 */
@Entity('order_events')
export class OrderEvent {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Orden a la que pertenece este evento. */
  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 21 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  /** Tipo de evento (ver `OrderEventType`). */
  @Column({ type: 'enum', enum: OrderEventType })
  type!: OrderEventType;

  /** Estado de la orden antes de esta transición, o `null` si el evento no representa un cambio de estado. */
  @Column({ name: 'from_status', type: 'enum', enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  /** Estado de la orden después de esta transición, o `null` si el evento no representa un cambio de estado. */
  @Column({ name: 'to_status', type: 'enum', enum: OrderStatus, nullable: true })
  toStatus!: OrderStatus | null;

  /** Proveedor de pago involucrado, si el evento es específico de un intento contra un PSP. */
  @Column({ type: 'enum', enum: PaymentProviderId, nullable: true })
  provider!: PaymentProviderId | null;

  /** Id del `PaymentAttempt` asociado, si aplica. */
  @Column({ name: 'attempt_id', type: 'varchar', length: 21, nullable: true })
  attemptId!: string | null;

  /** Texto de auditoría corto y seguro (nunca el payload/token crudo de un PSP). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  detail!: string | null;

  /** Fecha en que ocurrió el evento. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
