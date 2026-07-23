import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { generateId } from '../../common/nanoid';
import { decimalTransformer } from '../../database/transformers/decimal.transformer';
import { DemoSession } from '../../session/entities/demo-session.entity';

/**
 * Producto del catálogo demo. `stockReserved` solo se muta dentro de la
 * transacción con lock de `StockReservationService`, nunca directamente.
 * Disponible = `stockTotal - stockReserved` (ver `available` en el servicio).
 */
@Entity('products')
export class Product {
  /** Nanoid de 21 chars, generado en `assignId()` antes del insert. */
  @PrimaryColumn({ type: 'varchar', length: 21 })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Precio unitario en pesos chilenos (CLP), sin decimales. */
  @Column({
    name: 'price_clp',
    type: 'decimal',
    precision: 12,
    scale: 0,
    transformer: decimalTransformer,
  })
  priceClp!: number;

  /** Unidades totales existentes (reservadas + disponibles). */
  @Column({ name: 'stock_total', type: 'int', unsigned: true })
  stockTotal!: number;

  /** Unidades actualmente reservadas por checkouts en curso; solo lo muta `StockReservationService` bajo lock. */
  @Column({ name: 'stock_reserved', type: 'int', unsigned: true, default: 0 })
  stockReserved!: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  /** `true` si el producto viene del seed de la demo; `false` si lo creó un visitante. */
  @Column({ name: 'is_seed', type: 'boolean', default: false })
  isSeed!: boolean;

  /** Sesión anónima que creó el producto, o `null` si es un producto seed. */
  @Column({ name: 'created_by_session_id', type: 'varchar', length: 21, nullable: true })
  createdBySessionId!: string | null;

  @ManyToOne(() => DemoSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_session_id' })
  createdBySession!: Relation<DemoSession> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Fecha de la última modificación (incluye cambios de stock). */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /** Fecha de borrado lógico (soft delete); `null` mientras el producto sigue activo. */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= generateId();
  }
}
