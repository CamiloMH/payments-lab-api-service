import { PaymentProviderId } from '@/domain';

/** Clave i18n del nombre visible de cada proveedor, resuelta por el front vía `messages/{es,en}.json`. */
export const PaymentMethodLabelKey: Readonly<Record<PaymentProviderId, string>> = {
  [PaymentProviderId.TransbankWebpayPlus]: 'paymentMethods.webpay',
  [PaymentProviderId.TransbankOneclick]: 'paymentMethods.oneclick',
  [PaymentProviderId.MercadoPagoCheckoutPro]: 'paymentMethods.mercadoPago',
  [PaymentProviderId.Stripe]: 'paymentMethods.stripe',
};
