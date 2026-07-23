import { PaymentProviderId } from '@/domain';
import { PaymentMethodLabelKey } from './payment-method-label-key.const';

/** El front resuelve estas claves en `messages/{es,en}.json`; un rename accidental rompería el selector de checkout. */
describe('PaymentMethodLabelKey', () => {
  it('fija la clave i18n de cada proveedor', () => {
    expect(PaymentMethodLabelKey).toStrictEqual({
      [PaymentProviderId.TransbankWebpayPlus]: 'paymentMethods.webpay',
      [PaymentProviderId.TransbankOneclick]: 'paymentMethods.oneclick',
      [PaymentProviderId.MercadoPagoCheckoutPro]: 'paymentMethods.mercadoPago',
      [PaymentProviderId.Stripe]: 'paymentMethods.stripe',
    });
  });
});
