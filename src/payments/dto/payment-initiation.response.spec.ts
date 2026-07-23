import { PaymentAttemptStatus, RedirectKind, type PaymentInitiation } from '@/domain';
import { PaymentInitiationResponse } from './payment-initiation.response';

describe('PaymentInitiationResponse.from', () => {
  it('expone kind, url y fields para la variante form_post', () => {
    const initiation: PaymentInitiation = {
      kind: RedirectKind.FormPost,
      url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      fields: { token_ws: 'abc123' },
    };

    const response = PaymentInitiationResponse.from(initiation);

    expect(response).toEqual({
      kind: RedirectKind.FormPost,
      url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction',
      fields: { token_ws: 'abc123' },
    });
  });

  it('expone kind y url para la variante url', () => {
    const initiation: PaymentInitiation = {
      kind: RedirectKind.Url,
      url: 'https://mercadopago.com/checkout/pref-1',
    };

    const response = PaymentInitiationResponse.from(initiation);

    expect(response).toEqual({
      kind: RedirectKind.Url,
      url: 'https://mercadopago.com/checkout/pref-1',
    });
  });

  it('oculta confirmation en la variante none (respuesta cruda del PSP)', () => {
    const initiation: PaymentInitiation = {
      kind: RedirectKind.None,
      confirmation: {
        approved: true,
        attemptStatus: PaymentAttemptStatus.Confirmed,
        externalPaymentId: 'ext-1',
        responseCode: '0',
        cardLast4: '6623',
        raw: { secreto: 'no-debe-salir' },
      },
    };

    const response = PaymentInitiationResponse.from(initiation);

    expect(response).toEqual({ kind: RedirectKind.None });
    expect(response).not.toHaveProperty('confirmation');
  });
});
