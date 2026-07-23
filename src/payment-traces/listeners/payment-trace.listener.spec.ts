import {
  PaymentProviderId,
  PaymentTracedEvent,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';

import type { PaymentTraceService } from '../payment-trace.service';
import { PaymentTraceListener } from './payment-trace.listener';

describe('PaymentTraceListener', () => {
  it('registra la traza delegando en PaymentTraceService.record', async () => {
    const traces = { record: jest.fn() } as unknown as PaymentTraceService;
    const listener = new PaymentTraceListener(traces);

    await listener.handle(
      new PaymentTracedEvent(
        'order-1',
        PaymentProviderId.Stripe,
        PaymentTraceType.Confirmed,
        PaymentTraceSource.Webhook,
        'attempt-1',
        true,
        null,
        'pi_123',
        '0',
        '4242',
        { id: 'pi_123' },
      ),
    );

    expect(traces.record).toHaveBeenCalledWith({
      orderId: 'order-1',
      attemptId: 'attempt-1',
      provider: PaymentProviderId.Stripe,
      type: PaymentTraceType.Confirmed,
      source: PaymentTraceSource.Webhook,
      approved: true,
      attemptStatus: null,
      externalPaymentId: 'pi_123',
      responseCode: '0',
      cardLast4: '4242',
      rawPayload: { id: 'pi_123' },
    });
  });
});
