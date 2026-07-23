import { Injectable, Logger } from '@nestjs/common';
import {
  type PaymentAttemptStatus,
  type PaymentProviderId,
  type PaymentTraceSource,
  type PaymentTraceType,
} from '@/domain';

import { formatLogFields } from '../common/logging/format-log-fields';
import { PaymentTrace } from './entities/payment-trace.entity';
import { PaymentTraceRepository } from './repositories/payment-trace.repository';

/** Datos para registrar una traza; los campos no aplicables se omiten (quedan `null`). */
export interface RecordPaymentTraceInput {
  orderId: string;
  provider: PaymentProviderId;
  type: PaymentTraceType;
  source: PaymentTraceSource;
  attemptId?: string | null;
  approved?: boolean | null;
  attemptStatus?: PaymentAttemptStatus | null;
  externalPaymentId?: string | null;
  responseCode?: string | null;
  cardLast4?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

/**
 * Punto único de escritura de la bitácora de trazabilidad de pagos
 * (`PaymentTrace`). Todo servicio que interactúa con un PSP (inicio de pago,
 * callback/webhook de confirmación, reembolso) registra la traza aquí en vez de
 * construir la entidad a mano, para que la bitácora sea consistente y capture
 * siempre la respuesta cruda del proveedor.
 */
@Injectable()
export class PaymentTraceService {
  private readonly logger = new Logger(PaymentTraceService.name);

  constructor(private readonly traces: PaymentTraceRepository) {}

  /** Registra una traza genérica de interacción con un PSP. */
  record(input: RecordPaymentTraceInput): Promise<PaymentTrace> {
    this.logger.debug(
      formatLogFields({ orderId: input.orderId, type: input.type, source: input.source }),
    );
    const trace = new PaymentTrace();
    trace.orderId = input.orderId;
    trace.attemptId = input.attemptId ?? null;
    trace.provider = input.provider;
    trace.type = input.type;
    trace.source = input.source;
    trace.approved = input.approved ?? null;
    trace.attemptStatus = input.attemptStatus ?? null;
    trace.externalPaymentId = input.externalPaymentId ?? null;
    trace.responseCode = input.responseCode ?? null;
    trace.cardLast4 = input.cardLast4 ?? null;
    trace.rawPayload = input.rawPayload ?? null;
    return this.traces.save(trace);
  }

  /** Bitácora completa de una orden, de la traza más antigua a la más reciente. */
  listByOrder(orderId: string): Promise<PaymentTrace[]> {
    return this.traces.findByOrder(orderId);
  }

  /** Última traza de cada orden del set (para enriquecer la lista de órdenes sin N+1). */
  latestByOrders(orderIds: string[]): Promise<Map<string, PaymentTrace>> {
    return this.traces.latestByOrders(orderIds);
  }
}
