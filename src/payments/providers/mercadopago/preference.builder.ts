import { CURRENCY } from '@/domain';

/** Body de `Preference.create({ body })` del SDK de Mercado Pago. */
export interface PreferenceRequestBody {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  external_reference: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: 'approved';
  notification_url: string;
}

/**
 * Ensambla paso a paso el body de una `Preference` de Checkout Pro. La demo
 * siempre vende 1 línea (el total de la orden como único ítem) y usa el
 * mismo `returnUrl` para las 3 variantes de `back_urls`; el builder evita
 * repetir esa forma en cada punto que la necesite y deja el resultado
 * fácil de leer de un vistazo en `MercadoPagoProvider`.
 */
export class PreferenceBuilder {
  private orderId!: string;
  private orderTitle!: string;
  private amountClp!: number;
  private returnUrl!: string;
  private notificationUrl!: string;

  forOrder(orderId: string, title: string, amountClp: number): this {
    this.orderId = orderId;
    this.orderTitle = title;
    this.amountClp = amountClp;
    return this;
  }

  withReturnUrl(returnUrl: string): this {
    this.returnUrl = returnUrl;
    return this;
  }

  withNotificationUrl(notificationUrl: string): this {
    this.notificationUrl = notificationUrl;
    return this;
  }

  build(): PreferenceRequestBody {
    return {
      items: [
        {
          id: this.orderId,
          title: this.orderTitle,
          quantity: 1,
          currency_id: CURRENCY,
          unit_price: this.amountClp,
        },
      ],
      external_reference: this.orderId,
      back_urls: { success: this.returnUrl, pending: this.returnUrl, failure: this.returnUrl },
      auto_return: 'approved',
      notification_url: this.notificationUrl,
    };
  }
}
