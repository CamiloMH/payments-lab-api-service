import { Body, Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentProviderId, PaymentTraceSource } from '@/domain';

import { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import { PaymentCallbackService } from '../payments/payment-callback.service';
import { MercadoPagoProvider } from '../payments/providers/mercadopago/mercadopago.provider';
import { MpWebhookGuard } from './mp-webhook.guard';

/** Body de la notificación de Mercado Pago (forma mínima que nos interesa). */
interface MercadoPagoWebhookBody {
  data?: { id?: string };
}

/**
 * Webhook asíncrono de Mercado Pago. Nunca confía en el payload de la
 * notificación: siempre resuelve la orden y verifica el pago consultando la
 * API real. Responde 200 siempre (incluso sin match) para que MP no reintente.
 */
@Controller({ path: 'webhooks/mercadopago', version: '1' })
export class MercadoPagoWebhookController {
  constructor(
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly paymentCallbackService: PaymentCallbackService,
    private readonly paymentAttempts: PaymentAttemptRepository,
  ) {}

  @Post()
  @UseGuards(MpWebhookGuard)
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handle(
    @Query('data.id') dataIdQuery: string,
    @Body() body: MercadoPagoWebhookBody,
  ): Promise<{ received: true }> {
    const paymentId = dataIdQuery || body?.data?.id;
    if (!paymentId) return { received: true };

    const orderId = await this.mercadoPagoProvider.resolveOrderId(paymentId);
    if (!orderId) return { received: true };

    const attempt = await this.paymentAttempts.findByOrderAndProvider(
      orderId,
      PaymentProviderId.MercadoPagoCheckoutPro,
    );
    if (!attempt) return { received: true };

    const confirmation = await this.mercadoPagoProvider.verifyPayment(paymentId, attempt);
    await this.paymentCallbackService.applyConfirmation(
      attempt,
      confirmation,
      PaymentTraceSource.Webhook,
    );
    return { received: true };
  }
}
