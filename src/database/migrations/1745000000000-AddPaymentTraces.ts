import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bitácora de trazabilidad de pagos (`payment_traces`): una fila por cada
 * interacción con un PSP (inicio, redirect, confirmación por callback/webhook,
 * reembolso), con la respuesta cruda del proveedor en `raw_payload`. FK a
 * `orders` (CASCADE) y a `payment_attempts` (SET NULL, nullable).
 */
export class AddPaymentTraces1745000000000 implements MigrationInterface {
  name = 'AddPaymentTraces1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`payment_traces\` (
        \`id\` varchar(21) NOT NULL,
        \`order_id\` varchar(21) NOT NULL,
        \`attempt_id\` varchar(21) NULL,
        \`provider\` enum('transbank_webpay_plus','transbank_oneclick','mercado_pago_checkout_pro','stripe') NOT NULL,
        \`type\` enum('initiated','redirected','confirmed','rejected','refunded','refund_failed') NOT NULL,
        \`source\` enum('initiation','callback','webhook','verification','refund') NOT NULL,
        \`approved\` tinyint NULL,
        \`attempt_status\` enum('initiated','redirected','confirmed','rejected','aborted','expired','error') NULL,
        \`external_payment_id\` varchar(255) NULL,
        \`response_code\` varchar(50) NULL,
        \`card_last4\` char(4) NULL,
        \`raw_payload\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_payment_traces_order_id\` (\`order_id\`),
        CONSTRAINT \`FK_payment_traces_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_payment_traces_attempt\` FOREIGN KEY (\`attempt_id\`) REFERENCES \`payment_attempts\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `payment_traces`;');
  }
}
