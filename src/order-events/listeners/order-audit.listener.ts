import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type OrderTransitionedEvent } from '@/domain';

import { formatLogFields } from '../../common/logging/format-log-fields';
import { OrderEventService } from '../order-event.service';

/**
 * Persiste el audit log de órdenes a partir de los eventos de dominio. Escucha
 * `AppEvent.OrderTransitioned` (emitido con `emitAsync` + await por quien
 * transiciona la orden) y delega en `OrderEventService.record`, de modo que los
 * servicios core ya no dependen del audit log directamente.
 */
@Injectable()
export class OrderAuditListener {
  private readonly logger = new Logger(OrderAuditListener.name);

  constructor(private readonly orderEvents: OrderEventService) {}

  @OnEvent(AppEvent.OrderTransitioned)
  async handle(event: OrderTransitionedEvent): Promise<void> {
    this.logger.log(
      formatLogFields({
        received: AppEvent.OrderTransitioned,
        orderId: event.orderId,
        type: event.type,
      }),
    );
    await this.orderEvents.record(event.orderId, event.type, {
      fromStatus: event.fromStatus ?? undefined,
      toStatus: event.toStatus ?? undefined,
      provider: event.provider ?? undefined,
      attemptId: event.attemptId ?? undefined,
      detail: event.detail ?? undefined,
    });
  }
}
