import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amplía el enum de la columna `payment_attempts.provider` para admitir
 * `stripe` (nuevo proveedor Checkout Session), conservando los tres existentes.
 * No se editan las migraciones viejas: el cambio de esquema va en una nueva.
 */
export class AddStripeProvider1743000000000 implements MigrationInterface {
  name = 'AddStripeProvider1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `payment_attempts` MODIFY COLUMN `provider` enum('transbank_webpay_plus','transbank_oneclick','mercado_pago_checkout_pro','stripe') NOT NULL;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `payment_attempts` MODIFY COLUMN `provider` enum('transbank_webpay_plus','transbank_oneclick','mercado_pago_checkout_pro') NOT NULL;",
    );
  }
}
