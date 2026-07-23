import type { ProductWithAvailability } from '../products.service';
import { ProductResponse } from './product.response';

function buildProduct(overrides: Partial<ProductWithAvailability> = {}): ProductWithAvailability {
  return {
    id: 'p1',
    name: 'Mouse',
    description: 'Mouse óptico',
    priceClp: 9990,
    stockTotal: 10,
    stockReserved: 3,
    imageUrl: 'https://example.com/mouse.png',
    isSeed: true,
    createdBySessionId: 'session-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    deletedAt: null,
    available: 7,
    ...overrides,
  } as ProductWithAvailability;
}

describe('ProductResponse.from', () => {
  it('expone id, name, description, priceClp, imageUrl y available', () => {
    const response = ProductResponse.from(buildProduct());

    expect(response).toEqual({
      id: 'p1',
      name: 'Mouse',
      description: 'Mouse óptico',
      priceClp: 9990,
      imageUrl: 'https://example.com/mouse.png',
      available: 7,
    });
  });

  it('expone imageUrl como null cuando el producto no tiene imagen', () => {
    const response = ProductResponse.from(buildProduct({ imageUrl: null }));

    expect(response.imageUrl).toBeNull();
  });

  it('no filtra campos internos o sensibles (stockReserved, isSeed, createdBySessionId, timestamps)', () => {
    const response = ProductResponse.from(buildProduct());

    expect(response).not.toHaveProperty('stockReserved');
    expect(response).not.toHaveProperty('isSeed');
    expect(response).not.toHaveProperty('createdBySessionId');
    expect(response).not.toHaveProperty('createdAt');
    expect(response).not.toHaveProperty('updatedAt');
    expect(response).not.toHaveProperty('deletedAt');
    expect(response).not.toHaveProperty('stockTotal');
  });
});
