import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { MercadoPagoModule } from '../payments/providers/mercadopago/mercadopago.module';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';
import { MpWebhookGuard } from './mp-webhook.guard';

/**
 * Notificaciones asíncronas de los PSP (hoy el webhook de Mercado Pago). Nunca
 * confía en el payload: resuelve la orden y verifica el pago contra la API real,
 * delegando en `PaymentCallbackService` (de `PaymentsModule`). Aislado en su
 * propio módulo para no mezclar la superficie pública de webhooks con el core.
 */
@Module({
  imports: [PaymentsModule, MercadoPagoModule],
  controllers: [MercadoPagoWebhookController],
  providers: [MpWebhookGuard],
})
export class WebhooksModule {}
