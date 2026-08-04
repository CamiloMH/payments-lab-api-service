import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1785866392625 implements MigrationInterface {
  name = 'Initial1785866392625';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payment_traces_provider_enum" AS ENUM('transbank_webpay_plus', 'transbank_oneclick', 'mercado_pago_checkout_pro', 'stripe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_traces_type_enum" AS ENUM('initiated', 'redirected', 'confirmed', 'rejected', 'refunded', 'refund_failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_traces_source_enum" AS ENUM('initiation', 'callback', 'webhook', 'verification', 'refund')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_traces_attempt_status_enum" AS ENUM('initiated', 'redirected', 'confirmed', 'rejected', 'aborted', 'expired', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_traces" ("id" character varying(21) NOT NULL, "order_id" character varying(21) NOT NULL, "attempt_id" character varying(21), "provider" "public"."payment_traces_provider_enum" NOT NULL, "type" "public"."payment_traces_type_enum" NOT NULL, "source" "public"."payment_traces_source_enum" NOT NULL, "approved" boolean, "attempt_status" "public"."payment_traces_attempt_status_enum", "external_payment_id" character varying(255), "response_code" character varying(50), "card_last4" character(4), "raw_payload" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f14c5248e930bbf3a58b0cdbf3f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7dd9f73ee84ff043ed9ad60339" ON "payment_traces" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_attempts_provider_enum" AS ENUM('transbank_webpay_plus', 'transbank_oneclick', 'mercado_pago_checkout_pro', 'stripe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_attempts_status_enum" AS ENUM('initiated', 'redirected', 'confirmed', 'rejected', 'aborted', 'expired', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_attempts" ("id" character varying(21) NOT NULL, "order_id" character varying(21) NOT NULL, "provider" "public"."payment_attempts_provider_enum" NOT NULL, "status" "public"."payment_attempts_status_enum" NOT NULL DEFAULT 'initiated', "external_token" character varying(255), "external_payment_id" character varying(255), "response_code" character varying(50), "authorization_code" character varying(50), "card_last4" character(4), "raw_response" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0d8a67c07a0fef98dfd20214e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" character varying(21) NOT NULL, "name" character varying(120) NOT NULL, "description" text NOT NULL, "price_clp" numeric(12,0) NOT NULL, "stock_total" integer NOT NULL, "stock_reserved" integer NOT NULL DEFAULT '0', "image_url" character varying(500), "is_seed" boolean NOT NULL DEFAULT false, "created_by_session_id" character varying(21), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cart_items" ("id" character varying(21) NOT NULL, "cart_id" character varying(21) NOT NULL, "product_id" character varying(21) NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."carts_status_enum" AS ENUM('active', 'checked_out', 'abandoned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "carts" ("id" character varying(21) NOT NULL, "session_id" character varying(21) NOT NULL, "status" "public"."carts_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inscribed_cards_status_enum" AS ENUM('active', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inscribed_cards" ("id" character varying(21) NOT NULL, "session_id" character varying(21) NOT NULL, "tbk_user" character varying(255) NOT NULL, "card_type" character varying(30) NOT NULL, "card_last4" character(4) NOT NULL, "status" "public"."inscribed_cards_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7a336d0d9b9776fd99cff8bcfd3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "demo_sessions" ("id" character varying(21) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c01ab53e5154479e902860654c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_events_type_enum" AS ENUM('order_created', 'payment_initiated', 'redirected_to_provider', 'payment_confirmed', 'payment_rejected', 'order_paid', 'payment_failed', 'order_cancelled', 'order_expired', 'retry_started', 'refund_requested', 'order_refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_events_from_status_enum" AS ENUM('pending_payment', 'paid', 'payment_failed', 'expired', 'cancelled', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_events_to_status_enum" AS ENUM('pending_payment', 'paid', 'payment_failed', 'expired', 'cancelled', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_events_provider_enum" AS ENUM('transbank_webpay_plus', 'transbank_oneclick', 'mercado_pago_checkout_pro', 'stripe')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_events" ("id" character varying(21) NOT NULL, "order_id" character varying(21) NOT NULL, "type" "public"."order_events_type_enum" NOT NULL, "from_status" "public"."order_events_from_status_enum", "to_status" "public"."order_events_to_status_enum", "provider" "public"."order_events_provider_enum", "attempt_id" character varying(21), "detail" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cc1b82b0fcf1be577d9d7ecbf8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b33cbf9a59cbee112d94bcb59d" ON "order_events" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" character varying(21) NOT NULL, "order_id" character varying(21) NOT NULL, "product_id" character varying(21) NOT NULL, "product_name" character varying(120) NOT NULL, "unit_price_clp" numeric(12,0) NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('pending_payment', 'paid', 'payment_failed', 'expired', 'cancelled', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" character varying(21) NOT NULL, "buy_order" character varying(26) NOT NULL, "order_number" character varying(12), "session_id" character varying(21) NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending_payment', "total_clp" numeric(12,0) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_507e014203242f83a370fa29e80" UNIQUE ("buy_order"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."stock_reservations_status_enum" AS ENUM('active', 'consumed', 'released', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_reservations" ("id" character varying(21) NOT NULL, "order_id" character varying(21) NOT NULL, "product_id" character varying(21) NOT NULL, "quantity" integer NOT NULL, "status" "public"."stock_reservations_status_enum" NOT NULL DEFAULT 'active', "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "released_at" TIMESTAMP, CONSTRAINT "PK_46ec0f5605d70f64654ad4e7bd9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b62ae3962b224398697e3f5dcc" ON "stock_reservations" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "callback_pivots" ("id" character(36) NOT NULL, "payment_attempt_id" character varying(21), "enrollment_session_id" character varying(21), "redirect_path" character varying(255) NOT NULL, "external_token" character varying(500), "expires_at" TIMESTAMP NOT NULL, "consumed_at" TIMESTAMP, CONSTRAINT "PK_b49411651e838fa4170f6b6dbe5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_traces" ADD CONSTRAINT "FK_7dd9f73ee84ff043ed9ad603392" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_traces" ADD CONSTRAINT "FK_0278e8f7eef70d7de20cc721d4d" FOREIGN KEY ("attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" ADD CONSTRAINT "FK_2a0b71e31054506a4b8d72a446e" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_17063b5eb713c587f2a4ca488ac" FOREIGN KEY ("created_by_session_id") REFERENCES "demo_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_6385a745d9e12a89b859bb25623" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_30e89257a105eab7648a35c7fce" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "carts" ADD CONSTRAINT "FK_f57f87515b7c25718dc380c69c7" FOREIGN KEY ("session_id") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inscribed_cards" ADD CONSTRAINT "FK_14242cb6a4b77be21808599d886" FOREIGN KEY ("session_id") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_events" ADD CONSTRAINT "FK_b33cbf9a59cbee112d94bcb59de" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_9263386c35b6b242540f9493b00" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_4a911af0c90c68d0d98e491cc53" FOREIGN KEY ("session_id") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_reservations" ADD CONSTRAINT "FK_d904f70cd085fa7af754778fcb2" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_reservations" ADD CONSTRAINT "FK_2796e997aec8cc5e92ac213f407" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "callback_pivots" ADD CONSTRAINT "FK_ae081acad420c45ed2ff974c7bd" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "callback_pivots" ADD CONSTRAINT "FK_7a0e38f2d9333bcfcd58b80c0da" FOREIGN KEY ("enrollment_session_id") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callback_pivots" DROP CONSTRAINT "FK_7a0e38f2d9333bcfcd58b80c0da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "callback_pivots" DROP CONSTRAINT "FK_ae081acad420c45ed2ff974c7bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_reservations" DROP CONSTRAINT "FK_2796e997aec8cc5e92ac213f407"`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_reservations" DROP CONSTRAINT "FK_d904f70cd085fa7af754778fcb2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_4a911af0c90c68d0d98e491cc53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_9263386c35b6b242540f9493b00"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_events" DROP CONSTRAINT "FK_b33cbf9a59cbee112d94bcb59de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inscribed_cards" DROP CONSTRAINT "FK_14242cb6a4b77be21808599d886"`,
    );
    await queryRunner.query(`ALTER TABLE "carts" DROP CONSTRAINT "FK_f57f87515b7c25718dc380c69c7"`);
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_30e89257a105eab7648a35c7fce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_6385a745d9e12a89b859bb25623"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_17063b5eb713c587f2a4ca488ac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_attempts" DROP CONSTRAINT "FK_2a0b71e31054506a4b8d72a446e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_traces" DROP CONSTRAINT "FK_0278e8f7eef70d7de20cc721d4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_traces" DROP CONSTRAINT "FK_7dd9f73ee84ff043ed9ad603392"`,
    );
    await queryRunner.query(`DROP TABLE "callback_pivots"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b62ae3962b224398697e3f5dcc"`);
    await queryRunner.query(`DROP TABLE "stock_reservations"`);
    await queryRunner.query(`DROP TYPE "public"."stock_reservations_status_enum"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b33cbf9a59cbee112d94bcb59d"`);
    await queryRunner.query(`DROP TABLE "order_events"`);
    await queryRunner.query(`DROP TYPE "public"."order_events_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_events_to_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_events_from_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_events_type_enum"`);
    await queryRunner.query(`DROP TABLE "demo_sessions"`);
    await queryRunner.query(`DROP TABLE "inscribed_cards"`);
    await queryRunner.query(`DROP TYPE "public"."inscribed_cards_status_enum"`);
    await queryRunner.query(`DROP TABLE "carts"`);
    await queryRunner.query(`DROP TYPE "public"."carts_status_enum"`);
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "payment_attempts"`);
    await queryRunner.query(`DROP TYPE "public"."payment_attempts_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_attempts_provider_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7dd9f73ee84ff043ed9ad60339"`);
    await queryRunner.query(`DROP TABLE "payment_traces"`);
    await queryRunner.query(`DROP TYPE "public"."payment_traces_attempt_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_traces_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_traces_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_traces_provider_enum"`);
  }
}
