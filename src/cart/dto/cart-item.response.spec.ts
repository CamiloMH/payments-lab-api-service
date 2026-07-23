import type { CartItem } from '../entities/cart-item.entity';
import { CartItemResponse } from './cart-item.response';

describe('CartItemResponse.from', () => {
  it('expone solo id, productId y quantity', () => {
    const item = { id: 'item-1', cartId: 'cart-1', productId: 'p1', quantity: 3 } as CartItem;

    const response = CartItemResponse.from(item);

    expect(response).toEqual({ id: 'item-1', productId: 'p1', quantity: 3 });
    expect(response).not.toHaveProperty('cartId');
  });
});
