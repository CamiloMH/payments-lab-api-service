import { Injectable, Logger, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureValidator } from 'mercadopago';

import { WebhookSignatureInvalidException } from '../payments/exceptions/webhook.exceptions';

interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

/** Headers del protocolo de firma de webhooks de Mercado Pago. */
const MercadoPagoHeader = {
  Signature: 'x-signature',
  RequestId: 'x-request-id',
} as const;

/**
 * Valida la firma `x-signature` de los webhooks de Mercado Pago. Sin
 * `MERCADOPAGO_WEBHOOK_SECRET` configurado (dev local sin túnel público) deja
 * pasar sin validar, documentado como riesgo aceptado fuera de producción.
 */
@Injectable()
export class MpWebhookGuard implements CanActivate {
  private readonly logger = new Logger(MpWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn(
        'webhook de Mercado Pago sin firma validada: MERCADOPAGO_WEBHOOK_SECRET no configurado (riesgo aceptado fuera de producción)',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<WebhookRequest>();
    try {
      WebhookSignatureValidator.validate({
        xSignature: request.headers[MercadoPagoHeader.Signature],
        xRequestId: request.headers[MercadoPagoHeader.RequestId],
        dataId: request.query['data.id'],
        secret,
      });
      return true;
    } catch {
      this.logger.warn('firma de webhook Mercado Pago inválida');
      throw new WebhookSignatureInvalidException();
    }
  }
}
