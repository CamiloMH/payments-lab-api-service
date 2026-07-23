import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProviderId,
  RESERVATION_TTL_MINUTES,
} from '@/domain';
import type { Cart } from '../../cart/entities/cart.entity';
import type { CartItem } from '../../cart/entities/cart-item.entity';
import type { Product } from '../../products/entities/product.entity';
import type { DemoSession } from '../../session/entities/demo-session.entity';
import { OrderFactory } from './order.factory';

function buildProduct(overrides: Partial<Product> = {}): Product {
  return { id: 'p1', name: 'Mouse', priceClp: 9990, ...overrides } as Product;
}

function buildCart(items: Partial<CartItem>[]): Cart {
  return { id: 'cart-1', sessionId: 'session-1', items: items as CartItem[] } as Cart;
}

function buildSession(): DemoSession {
  return { id: 'session-1' } as DemoSession;
}

describe('OrderFactory.createPendingOrder', () => {
  it('arma una orden PendingPayment con buyOrder derivado del id y expiresAt a RESERVATION_TTL_MINUTES', () => {
    const cart = buildCart([{ productId: 'p1', quantity: 2 }]);
    const productById = new Map([['p1', buildProduct({ priceClp: 9990 })]]);
    const before = Date.now();

    const { order } = OrderFactory.createPendingOrder({
      orderId: 'order-1',
      session: buildSession(),
      cart,
      productById,
    });
    const after = Date.now();

    expect(order.id).toBe('order-1');
    expect(order.buyOrder).toBe('PL-order-1');
    expect(order.sessionId).toBe('session-1');
    expect(order.status).toBe(OrderStatus.PendingPayment);
    expect(order.totalClp).toBe(19980);
    expect(order.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + RESERVATION_TTL_MINUTES * 60_000,
    );
    expect(order.expiresAt.getTime()).toBeLessThanOrEqual(after + RESERVATION_TTL_MINUTES * 60_000);
  });

  it('suma priceClp × quantity de todos los ítems para totalClp', () => {
    const cart = buildCart([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 3 },
    ]);
    const productById = new Map([
      ['p1', buildProduct({ id: 'p1', priceClp: 1000 })],
      ['p2', buildProduct({ id: 'p2', priceClp: 500 })],
    ]);

    const { order } = OrderFactory.createPendingOrder({
      orderId: 'order-1',
      session: buildSession(),
      cart,
      productById,
    });

    expect(order.totalClp).toBe(3500);
  });

  it('crea un OrderItem por ítem del carrito con snapshot de nombre y precio del producto', () => {
    const cart = buildCart([{ productId: 'p1', quantity: 3 }]);
    const productById = new Map([
      ['p1', buildProduct({ id: 'p1', name: 'Mouse gamer', priceClp: 9990 })],
    ]);

    const { items } = OrderFactory.createPendingOrder({
      orderId: 'order-1',
      session: buildSession(),
      cart,
      productById,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      orderId: 'order-1',
      productId: 'p1',
      productName: 'Mouse gamer',
      unitPriceClp: 9990,
      quantity: 3,
    });
  });
});

describe('OrderFactory.createInitialAttempt', () => {
  it('crea un PaymentAttempt Initiated para la orden y el proveedor dados', () => {
    const attempt = OrderFactory.createInitialAttempt(
      'order-1',
      PaymentProviderId.MercadoPagoCheckoutPro,
    );

    expect(attempt.orderId).toBe('order-1');
    expect(attempt.provider).toBe(PaymentProviderId.MercadoPagoCheckoutPro);
    expect(attempt.status).toBe(PaymentAttemptStatus.Initiated);
  });
});
