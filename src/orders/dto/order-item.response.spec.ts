import type { Product } from '../../products/entities/product.entity';
import type { OrderItem } from '../entities/order-item.entity';
import { OrderItemResponse } from './order-item.response';

function buildOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    orderId: 'order-1',
    productId: 'product-1',
    productName: 'Mouse óptico inalámbrico',
    unitPriceClp: 9990,
    quantity: 2,
    ...overrides,
  } as OrderItem;
}

describe('OrderItemResponse.from', () => {
  it('expone id, productId, productName, unitPriceClp, quantity e imageUrl', () => {
    const response = OrderItemResponse.from(
      buildOrderItem({ product: { imageUrl: 'https://cdn.test/mouse.jpg' } as Product }),
    );

    expect(response).toEqual({
      id: 'item-1',
      productId: 'product-1',
      productName: 'Mouse óptico inalámbrico',
      unitPriceClp: 9990,
      quantity: 2,
      imageUrl: 'https://cdn.test/mouse.jpg',
    });
  });

  it('deja imageUrl en null si la relación product no vino cargada', () => {
    const response = OrderItemResponse.from(buildOrderItem());

    expect(response.imageUrl).toBeNull();
  });

  it('no filtra el orderId interno', () => {
    const response = OrderItemResponse.from(buildOrderItem());

    expect(response).not.toHaveProperty('orderId');
  });
});
