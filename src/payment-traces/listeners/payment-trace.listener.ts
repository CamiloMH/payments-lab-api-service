import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type PaymentTracedEvent } from '@/domain';

import { formatLogFields } from '../../common/logging/format-log-fields';
import { PaymentTraceService } from '../payment-trace.service';

/**
 * Persiste la bitácora de trazabilidad de pagos a partir de los eventos de
 * dominio. Escucha `AppEvent.PaymentTraced` (emitido con `emitAsync` + await por
 * los servicios de pago) y delega en `PaymentTraceService.record`, desacoplando
 * la captura de trazas de quien las origina.
 */
@Injectable()
export class PaymentTraceListener {
  private readonly logger = new Logger(PaymentTraceListener.name);

  constructor(private readonly traces: PaymentTraceService) {}

  @OnEvent(AppEvent.PaymentTraced)
  async handle(event: PaymentTracedEvent): Promise<void> {
    this.logger.log(
      formatLogFields({
        received: AppEvent.PaymentTraced,
        orderId: event.orderId,
        type: event.type,
      }),
    );
    await this.traces.record({
      orderId: event.orderId,
      attemptId: event.attemptId,
      provider: event.provider,
      type: event.type,
      source: event.source,
      approved: event.approved,
      attemptStatus: event.attemptStatus,
      externalPaymentId: event.externalPaymentId,
      responseCode: event.responseCode,
      cardLast4: event.cardLast4,
      rawPayload: event.rawPayload,
    });
  }
}
