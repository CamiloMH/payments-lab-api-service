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

import { PaymentAttemptStatus, PaymentProviderId } from '@/domain';

import { generateId } from '../../common/nanoid';
import { Order } from '../../orders/entities/order.entity';
import { PaymentTrace } from '../../payment-traces/entities/payment-trace.entity';

/**
 * Traza de un intento de pago contra un proveedor. El `id` es el buyOrder
 * "hijo" enviado a Transbank (prefijo `PLC-` + 21 chars = 25 ≤ 26 máx SDK).
 */
@Entity('payment_attempts')
export class PaymentAttempt {
  /** Nanoid de 21 chars; también es el buyOrder "hijo" enviado a Transbank (prefijo `PLC-` + este id). */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Orden a la que pertenece este intento. */
  @Column({ name: 'order_id', type: 'varchar', length: 21 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.paymentAttempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  /** Proveedor de pago contra el que se abrió el intento. */
  @Column({ type: 'enum', enum: PaymentProviderId })
  provider!: PaymentProviderId;

  /** Estado del intento (`initiated` → `redirected`/`confirmed`/`rejected`/`aborted`/`expired`/`error`). */
  @Column({ type: 'enum', enum: PaymentAttemptStatus, default: PaymentAttemptStatus.Initiated })
  status!: PaymentAttemptStatus;

  /** Token de la transacción con el PSP (ej. `token_ws` de Webpay), guardado antes del commit para poder reembolsar aunque falle. */
  @Column({ name: 'external_token', type: 'varchar', length: 255, nullable: true })
  externalToken!: string | null;

  /** Id de la transacción en el sistema del PSP, si lo informó. */
  @Column({ name: 'external_payment_id', type: 'varchar', length: 255, nullable: true })
  externalPaymentId!: string | null;

  /** Código de respuesta crudo del PSP (formato específico de cada uno). */
  @Column({ name: 'response_code', type: 'varchar', length: 50, nullable: true })
  responseCode!: string | null;

  /** Código de autorización del PSP (Transbank), si aplica. */
  @Column({ name: 'authorization_code', type: 'varchar', length: 50, nullable: true })
  authorizationCode!: string | null;

  /** Últimos 4 dígitos de la tarjeta usada, si el PSP los informó. */
  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4!: string | null;

  /** Respuesta cruda del PSP, para debugging/auditoría; nunca se expone al front. */
  @Column({ name: 'raw_response', type: 'json', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  /** Fecha de creación del intento. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Fecha de la última actualización de estado. */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Trazas de trazabilidad registradas para este intento. */
  @OneToMany(() => PaymentTrace, (trace) => trace.attempt)
  traces!: PaymentTrace[];

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
