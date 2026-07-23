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

import { generateId } from '../../common/nanoid';
import { DemoSession } from '../../session/entities/demo-session.entity';
import { CartItem } from './cart-item.entity';

/** Estado del carrito. Solo puede existir un carrito `active` por sesión. */
export enum CartStatus {
  Active = 'active',
  CheckedOut = 'checked_out',
  Abandoned = 'abandoned',
}

/** Carrito server-side de una sesión anónima; input directo del checkout. */
@Entity('carts')
export class Cart {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 21 })
  sessionId!: string;

  @ManyToOne(() => DemoSession, (session) => session.carts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Relation<DemoSession>;

  @Column({ type: 'enum', enum: CartStatus, default: CartStatus.Active })
  status!: CartStatus;

  @OneToMany(() => CartItem, (item) => item.cart)
  items!: CartItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
