import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial: las 9 tablas del dominio (sesiones, catálogo, carrito,
 * órdenes, reservas de stock y todo lo relacionado a pagos). Ver
 * `docs/architecture.md` para el diagrama de relaciones.
 */
export class Initial1732000000000 implements MigrationInterface {
  name = 'Initial1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`demo_sessions\` (
        \`id\` varchar(21) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`last_seen_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`products\` (
        \`id\` varchar(21) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`description\` text NOT NULL,
        \`price_clp\` decimal(12,0) NOT NULL,
        \`stock_total\` int unsigned NOT NULL,
        \`stock_reserved\` int unsigned NOT NULL DEFAULT '0',
        \`image_url\` varchar(500) NULL,
        \`is_seed\` tinyint NOT NULL DEFAULT 0,
        \`created_by_session_id\` varchar(21) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_products_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`carts\` (
        \`id\` varchar(21) NOT NULL,
        \`session_id\` varchar(21) NOT NULL,
        \`status\` enum('active','checked_out','abandoned') NOT NULL DEFAULT 'active',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_carts_session_id\` (\`session_id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`cart_items\` (
        \`id\` varchar(21) NOT NULL,
        \`cart_id\` varchar(21) NOT NULL,
        \`product_id\` varchar(21) NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_cart_items_cart_product\` (\`cart_id\`, \`product_id\`),
        CONSTRAINT \`FK_cart_items_cart\` FOREIGN KEY (\`cart_id\`) REFERENCES \`carts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`orders\` (
        \`id\` varchar(21) NOT NULL,
        \`buy_order\` varchar(26) NOT NULL,
        \`session_id\` varchar(21) NOT NULL,
        \`status\` enum('pending_payment','paid','payment_failed','expired','cancelled','refunded') NOT NULL DEFAULT 'pending_payment',
        \`total_clp\` decimal(12,0) NOT NULL,
        \`expires_at\` datetime NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_orders_buy_order\` (\`buy_order\`),
        INDEX \`IDX_orders_session_id\` (\`session_id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`order_items\` (
        \`id\` varchar(21) NOT NULL,
        \`order_id\` varchar(21) NOT NULL,
        \`product_id\` varchar(21) NOT NULL,
        \`product_name\` varchar(120) NOT NULL,
        \`unit_price_clp\` decimal(12,0) NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_order_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`stock_reservations\` (
        \`id\` varchar(21) NOT NULL,
        \`order_id\` varchar(21) NOT NULL,
        \`product_id\` varchar(21) NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        \`status\` enum('active','consumed','released','expired') NOT NULL DEFAULT 'active',
        \`expires_at\` datetime NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`released_at\` datetime NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_stock_reservations_expires_at\` (\`expires_at\`),
        INDEX \`IDX_stock_reservations_order_id\` (\`order_id\`),
        INDEX \`IDX_stock_reservations_product_id\` (\`product_id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`payment_attempts\` (
        \`id\` varchar(21) NOT NULL,
        \`order_id\` varchar(21) NOT NULL,
        \`provider\` enum('transbank_webpay_plus','transbank_oneclick','mercado_pago_checkout_pro') NOT NULL,
        \`status\` enum('initiated','redirected','confirmed','rejected','aborted','expired','error') NOT NULL DEFAULT 'initiated',
        \`external_token\` varchar(255) NULL,
        \`external_payment_id\` varchar(255) NULL,
        \`response_code\` varchar(50) NULL,
        \`authorization_code\` varchar(50) NULL,
        \`card_last4\` char(4) NULL,
        \`raw_response\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_payment_attempts_order_id\` (\`order_id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`callback_pivots\` (
        \`id\` char(36) NOT NULL,
        \`payment_attempt_id\` varchar(21) NULL,
        \`enrollment_session_id\` varchar(21) NULL,
        \`redirect_path\` varchar(255) NOT NULL,
        \`expires_at\` datetime NOT NULL,
        \`consumed_at\` datetime NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE \`inscribed_cards\` (
        \`id\` varchar(21) NOT NULL,
        \`session_id\` varchar(21) NOT NULL,
        \`tbk_user\` varchar(255) NOT NULL,
        \`card_type\` varchar(30) NOT NULL,
        \`card_last4\` char(4) NOT NULL,
        \`status\` enum('active','deleted') NOT NULL DEFAULT 'active',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_inscribed_cards_session_id\` (\`session_id\`)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `inscribed_cards`;');
    await queryRunner.query('DROP TABLE `callback_pivots`;');
    await queryRunner.query('DROP TABLE `payment_attempts`;');
    await queryRunner.query('DROP TABLE `stock_reservations`;');
    await queryRunner.query('DROP TABLE `order_items`;');
    await queryRunner.query('DROP TABLE `orders`;');
    await queryRunner.query('DROP TABLE `cart_items`;');
    await queryRunner.query('DROP TABLE `carts`;');
    await queryRunner.query('DROP TABLE `products`;');
    await queryRunner.query('DROP TABLE `demo_sessions`;');
  }
}
