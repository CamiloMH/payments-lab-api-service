import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { randomUUID } from 'node:crypto';

import { DemoSession } from '../../session/entities/demo-session.entity';
import { PaymentAttempt } from '../../payments/entities/payment-attempt.entity';

/**
 * Contexto de un retorno redirect (Webpay/MP) o de una inscripción Oneclick,
 * indexado por un UUID que viaja en el `returnUrl`/`back_url` como `?pivot=`.
 * TTL corto (`PIVOT_TTL_MINUTES`) y `consumedAt` evitan reprocesar el mismo
 * callback dos veces.
 */
@Entity('callback_pivots')
export class CallbackPivot {
  /** UUID v4, generado en `assignId()` antes del insert; viaja en el `returnUrl`/`back_url` como `?pivot=`. */
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  /** Intento de pago asociado, si el pivot es de un flujo de checkout (exactamente uno de los dos ids está presente). */
  @Column({ name: 'payment_attempt_id', type: 'varchar', length: 21, nullable: true })
  paymentAttemptId!: string | null;

  @ManyToOne(() => PaymentAttempt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_attempt_id' })
  paymentAttempt!: Relation<PaymentAttempt> | null;

  /** Sesión asociada, si el pivot es de un flujo de inscripción de tarjeta. */
  @Column({ name: 'enrollment_session_id', type: 'varchar', length: 21, nullable: true })
  enrollmentSessionId!: string | null;

  @ManyToOne(() => DemoSession, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_session_id' })
  enrollmentSession!: Relation<DemoSession> | null;

  /** Path relativo de la web al que redirigir tras resolver el callback. */
  @Column({ name: 'redirect_path', type: 'varchar', length: 255 })
  redirectPath!: string;

  /**
   * Token que devolvió `start()` de la inscripción Oneclick. Se guarda al
   * iniciar y se usa en `finish()` al volver del callback; es más confiable
   * que depender de que Transbank reenvíe `TBK_TOKEN` en el retorno (llega
   * vacío según el flujo). `null` en los pivots de pago (Webpay/MP).
   */
  @Column({ name: 'external_token', type: 'varchar', length: 500, nullable: true })
  externalToken!: string | null;

  /** Vencimiento del pivot (`PIVOT_TTL_MINUTES` desde su creación). */
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  /** Fecha en que se consumió el pivot; `null` mientras sigue pendiente. Protege contra reprocesar el mismo callback (replay). */
  @Column({ name: 'consumed_at', type: 'datetime', nullable: true })
  consumedAt!: Date | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
