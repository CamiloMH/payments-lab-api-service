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
import { decimalTransformer } from '../../database/transformers/decimal.transformer';
import { Product } from '../../products/entities/product.entity';
import { Order } from './order.entity';

/**
 * Línea de una orden. Guarda un snapshot de nombre y precio al momento de la
 * compra: si el producto cambia después, la orden histórica no se ve afectada.
 */
@Entity('order_items')
export class OrderItem {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  /** Id de la orden a la que pertenece esta línea. */
  @Column({ name: 'order_id', type: 'varchar', length: 21 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  /** Id del producto comprado. */
  @Column({ name: 'product_id', type: 'varchar', length: 21 })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  /** Nombre del producto al momento de la compra (snapshot). */
  @Column({ name: 'product_name', type: 'varchar', length: 120 })
  productName!: string;

  /** Precio unitario en CLP al momento de la compra (snapshot). */
  @Column({
    name: 'unit_price_clp',
    type: 'decimal',
    precision: 12,
    scale: 0,
    transformer: decimalTransformer,
  })
  unitPriceClp!: number;

  /** Unidades compradas de este producto. */
  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
