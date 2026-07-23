import {
  OrderStatus,
  PaymentAttemptStatus,
  type PaymentProviderId,
  RESERVATION_TTL_MINUTES,
} from '@/domain';
import type { Cart } from '../../cart/entities/cart.entity';
import type { Product } from '../../products/entities/product.entity';
import { PaymentAttempt } from '../../payments/entities/payment-attempt.entity';
import type { DemoSession } from '../../session/entities/demo-session.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

export interface CreatePendingOrderInput {
  orderId: string;
  session: DemoSession;
  cart: Cart;
  productById: Map<string, Product>;
}

export interface CreatePendingOrderResult {
  order: Order;
  items: OrderItem[];
}

/**
 * Construye las entidades de una orden nueva y su intento de pago inicial.
 * Puramente constructiva (no persiste nada): centraliza en un solo lugar
 * cómo nace una `Order`: el `buyOrder` derivado del id, el snapshot de
 * `productName`/`unitPriceClp` por ítem (para que cambios futuros al
 * catálogo no alteren órdenes ya creadas) y el TTL de la reserva.
 */
export class OrderFactory {
  static createPendingOrder({
    orderId,
    session,
    cart,
    productById,
  }: CreatePendingOrderInput): CreatePendingOrderResult {
    const totalClp = cart.items.reduce(
      (sum, item) => sum + productById.get(item.productId)!.priceClp * item.quantity,
      0,
    );

    const order = new Order();
    order.id = orderId;
    order.buyOrder = `PL-${orderId}`;
    order.sessionId = session.id;
    order.status = OrderStatus.PendingPayment;
    order.totalClp = totalClp;
    order.expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000);

    const items = cart.items.map((item) => {
      const product = productById.get(item.productId)!;
      const orderItem = new OrderItem();
      orderItem.orderId = orderId;
      orderItem.productId = item.productId;
      orderItem.productName = product.name;
      orderItem.unitPriceClp = product.priceClp;
      orderItem.quantity = item.quantity;
      return orderItem;
    });

    return { order, items };
  }

  static createInitialAttempt(orderId: string, provider: PaymentProviderId): PaymentAttempt {
    const attempt = new PaymentAttempt();
    attempt.orderId = orderId;
    attempt.provider = provider;
    attempt.status = PaymentAttemptStatus.Initiated;
    return attempt;
  }
}
