import {
  PaymentAttemptStatus,
  PaymentProviderId,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';
import type { PaymentTrace } from '../entities/payment-trace.entity';
import { PaymentTraceResponse } from './payment-trace.response';

function buildTrace(overrides: Partial<PaymentTrace> = {}): PaymentTrace {
  return {
    id: 'trace-1',
    orderId: 'order-1',
    attemptId: 'attempt-1',
    provider: PaymentProviderId.Stripe,
    type: PaymentTraceType.Confirmed,
    source: PaymentTraceSource.Webhook,
    approved: true,
    attemptStatus: PaymentAttemptStatus.Confirmed,
    externalPaymentId: 'pi_123',
    responseCode: '0',
    cardLast4: '4242',
    rawPayload: { secret: 'no-exponer', id: 'pi_123' },
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    ...overrides,
  } as unknown as PaymentTrace;
}

describe('PaymentTraceResponse.from', () => {
  it('expone los campos seguros estructurados', () => {
    const response = PaymentTraceResponse.from(buildTrace());

    expect(response).toEqual({
      id: 'trace-1',
      provider: PaymentProviderId.Stripe,
      type: PaymentTraceType.Confirmed,
      source: PaymentTraceSource.Webhook,
      approved: true,
      attemptStatus: PaymentAttemptStatus.Confirmed,
      responseCode: '0',
      cardLast4: '4242',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    });
  });

  it('NUNCA expone rawPayload (respuesta cruda del PSP) ni ids internos', () => {
    const response = PaymentTraceResponse.from(buildTrace());

    expect(response).not.toHaveProperty('rawPayload');
    expect(response).not.toHaveProperty('orderId');
    expect(response).not.toHaveProperty('attemptId');
    expect(response).not.toHaveProperty('externalPaymentId');
  });
});
