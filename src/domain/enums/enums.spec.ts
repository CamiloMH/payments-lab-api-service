import { CardStatus } from './card-status.enum';
import { OrderEventType } from './order-event-type.enum';
import { OrderStatus } from './order-status.enum';
import { PaymentAttemptStatus } from './payment-attempt-status.enum';
import { PaymentProviderId } from './payment-provider-id.enum';
import { PaymentTraceSource } from './payment-trace-source.enum';
import { PaymentTraceType } from './payment-trace-type.enum';
import { RedirectKind } from './redirect-kind.enum';
import { ReservationStatus } from './reservation-status.enum';

/**
 * Estos valores son el contrato con las columnas `enum(...)` de MariaDB: un
 * rename accidental del string rompería la persistencia sin que TypeScript lo
 * detecte (los enums de TS no verifican el valor contra la migración SQL).
 */
describe('valores de enums de dominio', () => {
  it('OrderStatus', () => {
    expect(OrderStatus).toStrictEqual({
      PendingPayment: 'pending_payment',
      Paid: 'paid',
      PaymentFailed: 'payment_failed',
      Expired: 'expired',
      Cancelled: 'cancelled',
      Refunded: 'refunded',
    });
  });

  it('PaymentProviderId', () => {
    expect(PaymentProviderId).toStrictEqual({
      TransbankWebpayPlus: 'transbank_webpay_plus',
      TransbankOneclick: 'transbank_oneclick',
      MercadoPagoCheckoutPro: 'mercado_pago_checkout_pro',
      Stripe: 'stripe',
    });
  });

  it('PaymentAttemptStatus', () => {
    expect(PaymentAttemptStatus).toStrictEqual({
      Initiated: 'initiated',
      Redirected: 'redirected',
      Confirmed: 'confirmed',
      Rejected: 'rejected',
      Aborted: 'aborted',
      Expired: 'expired',
      Error: 'error',
    });
  });

  it('ReservationStatus', () => {
    expect(ReservationStatus).toStrictEqual({
      Active: 'active',
      Consumed: 'consumed',
      Released: 'released',
      Expired: 'expired',
    });
  });

  it('RedirectKind', () => {
    expect(RedirectKind).toStrictEqual({
      FormPost: 'form_post',
      Url: 'url',
      None: 'none',
    });
  });

  it('CardStatus', () => {
    expect(CardStatus).toStrictEqual({
      Active: 'active',
      Deleted: 'deleted',
    });
  });

  it('PaymentTraceType', () => {
    expect(PaymentTraceType).toStrictEqual({
      Initiated: 'initiated',
      Redirected: 'redirected',
      Confirmed: 'confirmed',
      Rejected: 'rejected',
      Refunded: 'refunded',
      RefundFailed: 'refund_failed',
    });
  });

  it('PaymentTraceSource', () => {
    expect(PaymentTraceSource).toStrictEqual({
      Initiation: 'initiation',
      Callback: 'callback',
      Webhook: 'webhook',
      Verification: 'verification',
      Refund: 'refund',
    });
  });

  it('OrderEventType', () => {
    expect(OrderEventType).toStrictEqual({
      OrderCreated: 'order_created',
      PaymentInitiated: 'payment_initiated',
      RedirectedToProvider: 'redirected_to_provider',
      PaymentConfirmed: 'payment_confirmed',
      PaymentRejected: 'payment_rejected',
      OrderPaid: 'order_paid',
      PaymentFailed: 'payment_failed',
      OrderCancelled: 'order_cancelled',
      OrderExpired: 'order_expired',
      RetryStarted: 'retry_started',
      RefundRequested: 'refund_requested',
      OrderRefunded: 'order_refunded',
    });
  });
});
