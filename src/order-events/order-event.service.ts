import { Injectable, Logger } from '@nestjs/common';
import { OrderEventType, OrderStatus, PaymentProviderId } from '@/domain';

import { OrderEvent } from './entities/order-event.entity';
import { OrderEventRepository } from './repositories/order-event.repository';
import { formatLogFields } from '../common/logging/format-log-fields';

/** Metadata opcional de un evento; los campos no aplicables al tipo de evento se omiten. */
export interface RecordOrderEventInput {
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  provider?: PaymentProviderId;
  attemptId?: string;
  detail?: string;
}

/**
 * Punto único de escritura del audit log de órdenes. Todo servicio que
 * transiciona una orden (checkout, callback de pago, cancelación, expiración,
 * devolución) registra el evento aquí en vez de construir `OrderEvent` a mano,
 * para que el timeline sea consistente y no se dupliquen los strings de tipo.
 */
@Injectable()
export class OrderEventService {
  private readonly logger = new Logger(OrderEventService.name);

  constructor(private readonly events: OrderEventRepository) {}

  record(
    orderId: string,
    type: OrderEventType,
    input: RecordOrderEventInput = {},
  ): Promise<OrderEvent> {
    this.logger.debug(formatLogFields({ orderId, type }));
    const event = new OrderEvent();
    event.orderId = orderId;
    event.type = type;
    event.fromStatus = input.fromStatus ?? null;
    event.toStatus = input.toStatus ?? null;
    event.provider = input.provider ?? null;
    event.attemptId = input.attemptId ?? null;
    event.detail = input.detail ?? null;
    return this.events.save(event);
  }

  /** Timeline completo de una orden, del evento más antiguo al más reciente. */
  listByOrder(orderId: string): Promise<OrderEvent[]> {
    return this.events.findByOrder(orderId);
  }
}
