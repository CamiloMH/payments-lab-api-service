import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';

import { generateId } from '../../common/nanoid';
import { Product } from '../../products/entities/product.entity';
import { Cart } from './cart.entity';

/** Ítem de carrito: producto + cantidad. Único por (cart, product). */
@Entity('cart_items')
export class CartItem {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  @Column({ name: 'cart_id', type: 'varchar', length: 21 })
  cartId!: string;

  @ManyToOne(() => Cart, (cart) => cart.items)
  @JoinColumn({ name: 'cart_id' })
  cart!: Relation<Cart>;

  @Column({ name: 'product_id', type: 'varchar', length: 21 })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
