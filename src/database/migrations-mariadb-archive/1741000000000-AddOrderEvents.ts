import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit log de órdenes (`order_events`): una fila por cada transición
 * relevante del ciclo de vida de una orden. Alimenta el timeline expuesto en
 * `GET /orders/:id/timeline`.
 */
export class AddOrderEvents1741000000000 implements MigrationInterface {
  name = 'AddOrderEvents1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`order_events\` (
        \`id\` varchar(21) NOT NULL,
        \`order_id\` varchar(21) NOT NULL,
        \`type\` enum(
          'order_created',
          'payment_initiated',
          'redirected_to_provider',
          'payment_confirmed',
          'payment_rejected',
          'order_paid',
          'payment_failed',
          'order_cancelled',
          'order_expired',
          'retry_started',
          'refund_requested',
          'order_refunded'
        ) NOT NULL,
        \`from_status\` enum('pending_payment','paid','payment_failed','expired','cancelled','refunded') NULL,
        \`to_status\` enum('pending_payment','paid','payment_failed','expired','cancelled','refunded') NULL,
        \`provider\` enum('transbank_webpay_plus','transbank_oneclick','mercado_pago_checkout_pro') NULL,
        \`attempt_id\` varchar(21) NULL,
        \`detail\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_order_events_order_id\` (\`order_id\`)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `order_events`;');
  }
}
