import { Product } from './entities/product.entity';
import { ProductNotFoundException } from './exceptions/product.exceptions';
import { ProductRepository } from './repositories/product.repository';
import { ProductsService } from './products.service';

type MockProductRepository = {
  findAll: jest.Mock;
  findPage: jest.Mock;
  findById: jest.Mock;
};

describe('ProductsService', () => {
  function buildRepository(overrides: Partial<MockProductRepository> = {}): ProductRepository {
    const mock: MockProductRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findPage: jest.fn().mockResolvedValue([[], 0]),
      findById: jest.fn(),
      ...overrides,
    };
    return mock as unknown as ProductRepository;
  }

  function buildProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'p1',
      name: 'Mouse',
      description: 'Mouse óptico',
      priceClp: 9990,
      stockTotal: 10,
      stockReserved: 3,
      imageUrl: null,
      isSeed: true,
      createdBySessionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    } as Product;
  }

  describe('list', () => {
    it('expone available = stockTotal - stockReserved por producto', async () => {
      const repository = buildRepository({
        findAll: jest.fn().mockResolvedValue([buildProduct({ stockTotal: 10, stockReserved: 3 })]),
      });
      const service = new ProductsService(repository);

      const [product] = await service.list();

      expect(product.available).toBe(7);
    });
  });

  describe('listPage', () => {
    it('devuelve la página con available calculado y los metadatos de paginación', async () => {
      const repository = buildRepository({
        findPage: jest
          .fn()
          .mockResolvedValue([[buildProduct({ stockTotal: 10, stockReserved: 3 })], 25]),
      });
      const service = new ProductsService(repository);

      const page = await service.listPage(2, 12);

      expect(repository.findPage).toHaveBeenCalledWith(12, 12);
      expect(page.items[0].available).toBe(7);
      expect(page).toMatchObject({ total: 25, page: 2, pageSize: 12, totalPages: 3 });
    });
  });

  describe('findById', () => {
    it('retorna el producto con su available', async () => {
      const repository = buildRepository({
        findById: jest.fn().mockResolvedValue(buildProduct({ stockTotal: 5, stockReserved: 5 })),
      });
      const service = new ProductsService(repository);

      const product = await service.findById('p1');

      expect(product.available).toBe(0);
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      const repository = buildRepository({ findById: jest.fn().mockResolvedValue(null) });
      const service = new ProductsService(repository);

      await expect(service.findById('missing')).rejects.toThrow(ProductNotFoundException);
    });
  });
});
