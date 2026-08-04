import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `external_token` a `callback_pivots`: guarda el token que devuelve
 * `start()` de la inscripción Oneclick para reusarlo en `finish()` al volver
 * del callback, sin depender de que Transbank reenvíe `TBK_TOKEN` (llega vacío).
 */
export class AddCallbackPivotExternalToken1742000000000 implements MigrationInterface {
  name = 'AddCallbackPivotExternalToken1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `callback_pivots` ADD COLUMN `external_token` varchar(500) NULL AFTER `redirect_path`;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `callback_pivots` DROP COLUMN `external_token`;');
  }
}
