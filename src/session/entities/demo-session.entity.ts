import {
  BeforeInsert,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { generateId } from '../../common/nanoid';
import { Cart } from '../../cart/entities/cart.entity';
import { InscribedCard } from '../../cards/entities/inscribed-card.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * Identidad anónima de un visitante (cookie `pl_session`). Es dueña del
 * carrito, las reservas, las órdenes y las tarjetas Oneclick inscritas.
 */
@Entity('demo_sessions')
export class DemoSession {
  /** Nanoid de 21 chars; también es el valor de la cookie `pl_session`. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Carritos de la sesión (a lo sumo uno `active`). */
  @OneToMany(() => Cart, (cart) => cart.session)
  carts!: Cart[];

  @OneToMany(() => Order, (order) => order.session)
  orders!: Order[];

  @OneToMany(() => InscribedCard, (card) => card.session)
  inscribedCards!: InscribedCard[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Fecha de la última request que usó esta sesión (refrescada por `SessionMiddleware`). */
  @UpdateDateColumn({ name: 'last_seen_at' })
  lastSeenAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
