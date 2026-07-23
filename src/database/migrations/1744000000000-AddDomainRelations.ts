import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convierte las FK "blandas" (columnas `xxx_id` sin constraint) del dominio en
 * relaciones reales con integridad referencial. Complementa las dos FK que ya
 * existían desde el esquema inicial (`FK_cart_items_cart`, `FK_order_items_order`).
 * MariaDB crea automáticamente el índice del FK en las columnas que no lo tienen.
 *
 * Criterio de `ON DELETE`: hacia los agregados dueños (orders/carts/sessions) →
 * CASCADE; hacia `products` → RESTRICT (usan soft-delete, las filas nunca
 * desaparecen y protegen los snapshots); columnas nullable de pertenencia
 * opcional → SET NULL.
 */
export class AddDomainRelations1744000000000 implements MigrationInterface {
  name = 'AddDomainRelations1744000000000';

  private readonly constraints: ReadonlyArray<{
    table: string;
    name: string;
    column: string;
    refTable: string;
    onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL';
  }> = [
    {
      table: 'carts',
      name: 'FK_carts_session',
      column: 'session_id',
      refTable: 'demo_sessions',
      onDelete: 'CASCADE',
    },
    {
      table: 'cart_items',
      name: 'FK_cart_items_product',
      column: 'product_id',
      refTable: 'products',
      onDelete: 'RESTRICT',
    },
    {
      table: 'orders',
      name: 'FK_orders_session',
      column: 'session_id',
      refTable: 'demo_sessions',
      onDelete: 'CASCADE',
    },
    {
      table: 'order_items',
      name: 'FK_order_items_product',
      column: 'product_id',
      refTable: 'products',
      onDelete: 'RESTRICT',
    },
    {
      table: 'stock_reservations',
      name: 'FK_stock_reservations_order',
      column: 'order_id',
      refTable: 'orders',
      onDelete: 'CASCADE',
    },
    {
      table: 'stock_reservations',
      name: 'FK_stock_reservations_product',
      column: 'product_id',
      refTable: 'products',
      onDelete: 'RESTRICT',
    },
    {
      table: 'payment_attempts',
      name: 'FK_payment_attempts_order',
      column: 'order_id',
      refTable: 'orders',
      onDelete: 'CASCADE',
    },
    {
      table: 'order_events',
      name: 'FK_order_events_order',
      column: 'order_id',
      refTable: 'orders',
      onDelete: 'CASCADE',
    },
    {
      table: 'callback_pivots',
      name: 'FK_callback_pivots_attempt',
      column: 'payment_attempt_id',
      refTable: 'payment_attempts',
      onDelete: 'SET NULL',
    },
    {
      table: 'callback_pivots',
      name: 'FK_callback_pivots_session',
      column: 'enrollment_session_id',
      refTable: 'demo_sessions',
      onDelete: 'CASCADE',
    },
    {
      table: 'inscribed_cards',
      name: 'FK_inscribed_cards_session',
      column: 'session_id',
      refTable: 'demo_sessions',
      onDelete: 'CASCADE',
    },
    {
      table: 'products',
      name: 'FK_products_created_by_session',
      column: 'created_by_session_id',
      refTable: 'demo_sessions',
      onDelete: 'SET NULL',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const fk of this.constraints) {
      await queryRunner.query(
        `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${fk.name}\` ` +
          `FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\`(\`id\`) ON DELETE ${fk.onDelete};`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const fk of [...this.constraints].reverse()) {
      await queryRunner.query(`ALTER TABLE \`${fk.table}\` DROP FOREIGN KEY \`${fk.name}\`;`);
    }
  }
}
