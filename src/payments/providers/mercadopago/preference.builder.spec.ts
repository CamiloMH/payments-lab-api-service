import { CURRENCY } from '@/domain';
import { PreferenceBuilder } from './preference.builder';

describe('PreferenceBuilder', () => {
  it('arma el body de Preference con item único, back_urls repetidas y auto_return approved', () => {
    const body = new PreferenceBuilder()
      .forOrder('order-1', 'Orden PL-order-1', 19980)
      .withReturnUrl('https://api.test/callback')
      .withNotificationUrl('https://api.test/webhooks/mercadopago')
      .build();

    expect(body).toStrictEqual({
      items: [
        {
          id: 'order-1',
          title: 'Orden PL-order-1',
          quantity: 1,
          currency_id: CURRENCY,
          unit_price: 19980,
        },
      ],
      external_reference: 'order-1',
      back_urls: {
        success: 'https://api.test/callback',
        pending: 'https://api.test/callback',
        failure: 'https://api.test/callback',
      },
      auto_return: 'approved',
      notification_url: 'https://api.test/webhooks/mercadopago',
    });
  });

  it('es fluido: cada método devuelve la misma instancia', () => {
    const builder = new PreferenceBuilder();

    expect(builder.forOrder('order-1', 'Orden 1', 1000)).toBe(builder);
    expect(builder.withReturnUrl('https://x')).toBe(builder);
    expect(builder.withNotificationUrl('https://y')).toBe(builder);
  });
});
