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

import {
  PaymentAttemptStatus,
  PaymentProviderId,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';

import { generateId } from '../../common/nanoid';
import { Order } from '../../orders/entities/order.entity';
import { PaymentAttempt } from '../../payments/entities/payment-attempt.entity';

/**
 * Bitácora append-only de la trazabilidad de un pago: una fila por cada
 * interacción con un PSP (inicio, redirect, confirmación por callback o webhook,
 * reembolso…). A diferencia de `OrderEvent` (audit log del ciclo de vida de la
 * orden, campos seguros), aquí se guarda además `rawPayload` con la respuesta
 * cruda del PSP para diagnóstico, que **nunca** se expone al front.
 */
@Entity('payment_traces')
export class PaymentTrace {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Orden a la que pertenece la traza. */
  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 21 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.traces, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  /** Intento de pago asociado, si la traza corresponde a uno concreto. */
  @Column({ name: 'attempt_id', type: 'varchar', length: 21, nullable: true })
  attemptId!: string | null;

  @ManyToOne(() => PaymentAttempt, (attempt) => attempt.traces, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt!: Relation<PaymentAttempt> | null;

  /** Proveedor de pago involucrado en la interacción. */
  @Column({ type: 'enum', enum: PaymentProviderId })
  provider!: PaymentProviderId;

  /** Qué representó la interacción (ver `PaymentTraceType`). */
  @Column({ type: 'enum', enum: PaymentTraceType })
  type!: PaymentTraceType;

  /** Canal que originó la traza (ver `PaymentTraceSource`). */
  @Column({ type: 'enum', enum: PaymentTraceSource })
  source!: PaymentTraceSource;

  /** Resultado del pago si la interacción lo resolvió, o `null` (p. ej. al iniciar/redirigir). */
  @Column({ type: 'boolean', nullable: true })
  approved!: boolean | null;

  /** Estado del intento resultante de la interacción, si aplica. */
  @Column({ name: 'attempt_status', type: 'enum', enum: PaymentAttemptStatus, nullable: true })
  attemptStatus!: PaymentAttemptStatus | null;

  /** Id de la transacción en el sistema del PSP, si lo informó. */
  @Column({ name: 'external_payment_id', type: 'varchar', length: 255, nullable: true })
  externalPaymentId!: string | null;

  /** Código de respuesta crudo del PSP (formato específico de cada uno). */
  @Column({ name: 'response_code', type: 'varchar', length: 50, nullable: true })
  responseCode!: string | null;

  /** Últimos 4 dígitos de la tarjeta usada, si el PSP los informó. */
  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4!: string | null;

  /** Respuesta cruda del PSP/webhook, para diagnóstico; NUNCA se expone al front. */
  @Column({ name: 'raw_payload', type: 'json', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  /** Fecha en que se registró la traza. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
