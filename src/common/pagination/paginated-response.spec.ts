import { PaginatedOrderResponse } from '../../orders/dto/paginated-order.response';
import { PaginatedProductResponse } from '../../products/dto/paginated-product.response';

describe('respuestas paginadas', () => {
  it('PaginatedProductResponse expone items + metadatos de paginación', () => {
    const response = Object.assign(new PaginatedProductResponse(), {
      items: [],
      total: 0,
      page: 1,
      pageSize: 12,
      totalPages: 0,
    });

    expect(response).toMatchObject({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 });
  });

  it('PaginatedOrderResponse expone items + metadatos de paginación', () => {
    const response = Object.assign(new PaginatedOrderResponse(), {
      items: [],
      total: 5,
      page: 2,
      pageSize: 12,
      totalPages: 1,
    });

    expect(response).toMatchObject({ items: [], total: 5, page: 2, pageSize: 12, totalPages: 1 });
  });
});
