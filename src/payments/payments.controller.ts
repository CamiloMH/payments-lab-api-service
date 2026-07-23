import { Controller, Get, Param, Post, Query, Body, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { type PaymentProviderId, PaymentTraceSource } from '@/domain';
import type { Response } from 'express';

import { DEFAULT_WEB_BASE_URL } from '../common/config.defaults';
import { CallbackPivotService } from '../callback-pivots/callback-pivot.service';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import { PaymentCallbackService } from './payment-callback.service';
import { PaymentProviderRegistry } from './registry/payment-provider.registry';

/**
 * Punto de retorno único para todos los PSP con flujo redirect. El `:provider`
 * del path resuelve el adaptador; el pivot (query `?pivot=`) resuelve el
 * intento de pago y a dónde volver en la web. Excluido de Scalar: no es un
 * endpoint que un cliente HTTP normal deba invocar directamente.
 */
@Controller({ path: 'payments/callback', version: '1' })
export class PaymentsController {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly callbackPivotService: CallbackPivotService,
    private readonly paymentCallbackService: PaymentCallbackService,
    private readonly paymentAttempts: PaymentAttemptRepository,
    private readonly configService: ConfigService,
  ) {}

  @Get(':provider')
  @ApiExcludeEndpoint()
  handleGet(
    @Param('provider') providerId: PaymentProviderId,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    return this.handleCallback(providerId, query, {}, res);
  }

  @Post(':provider')
  @ApiExcludeEndpoint()
  handlePost(
    @Param('provider') providerId: PaymentProviderId,
    @Query() query: Record<string, string>,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    return this.handleCallback(providerId, query, body, res);
  }

  private async handleCallback(
    providerId: PaymentProviderId,
    query: Record<string, string>,
    body: Record<string, string>,
    res: Response,
  ): Promise<void> {
    const pivot = await this.callbackPivotService.consume(query.pivot);
    const attempt = await this.paymentAttempts.findByIdOrFail(pivot.paymentAttemptId!);

    const provider = this.registry.resolve(providerId);
    const confirmation = await provider.confirmFromCallback({ query, body, attempt });
    const order = await this.paymentCallbackService.applyConfirmation(
      attempt,
      confirmation,
      PaymentTraceSource.Callback,
    );

    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL') ?? DEFAULT_WEB_BASE_URL;
    res.redirect(302, `${webBaseUrl}${pivot.redirectPath}&status=${order.status}`);
  }
}
