import { CartStatus, type Cart } from '../entities/cart.entity';
import type { CartItem } from '../entities/cart-item.entity';
import { CartResponse } from './cart.response';

describe('CartResponse.from', () => {
  it('expone id e items (con items ya mapeados a su forma pública), oculta sessionId y status', () => {
    const cart = {
      id: 'cart-1',
      sessionId: 'session-1',
      status: CartStatus.Active,
      items: [{ id: 'item-1', cartId: 'cart-1', productId: 'p1', quantity: 2 } as CartItem],
    } as Cart;

    const response = CartResponse.from(cart);

    expect(response).toEqual({
      id: 'cart-1',
      items: [{ id: 'item-1', productId: 'p1', quantity: 2 }],
    });
    expect(response).not.toHaveProperty('sessionId');
    expect(response).not.toHaveProperty('status');
    expect(response.items[0]).not.toHaveProperty('cartId');
  });
});
