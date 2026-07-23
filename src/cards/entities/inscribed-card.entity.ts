import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';

import { CardStatus } from '@/domain';

import { generateId } from '../../common/nanoid';
import { DemoSession } from '../../session/entities/demo-session.entity';

/** Tarjeta inscrita vía Oneclick, ligada a una sesión anónima (no a un usuario). */
@Entity('inscribed_cards')
export class InscribedCard {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Sesión anónima dueña de la tarjeta. */
  @Column({ name: 'session_id', type: 'varchar', length: 21 })
  sessionId!: string;

  @ManyToOne(() => DemoSession, (session) => session.inscribedCards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Relation<DemoSession>;

  /** Identificador que Transbank asigna a la inscripción; se usa para autorizar cobros Oneclick, nunca se expone al front. */
  @Column({ name: 'tbk_user', type: 'varchar', length: 255 })
  tbkUser!: string;

  /** Tipo de tarjeta informado por Transbank (ej. "Visa"). */
  @Column({ name: 'card_type', type: 'varchar', length: 30 })
  cardType!: string;

  /** Últimos 4 dígitos de la tarjeta. */
  @Column({ name: 'card_last4', type: 'char', length: 4 })
  cardLast4!: string;

  /** Estado de la tarjeta: activa o eliminada por el usuario. */
  @Column({ type: 'enum', enum: CardStatus, default: CardStatus.Active })
  status!: CardStatus;

  /** Fecha en que se inscribió la tarjeta. */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
