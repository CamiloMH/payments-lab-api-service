import type { Repository } from 'typeorm';

import { Product } from '../entities/product.entity';
import { ProductRepository } from './product.repository';

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    ...overrides,
  };
}

describe('ProductRepository', () => {
  it('findAll ordena por createdAt DESC', async () => {
    const repo = mockRepo();
    const repository = new ProductRepository(repo as unknown as Repository<Product>);

    await repository.findAll();

    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
  });

  it('findPage pagina ordenando por createdAt DESC y devuelve [items, total]', async () => {
    const repo = mockRepo({ findAndCount: jest.fn().mockResolvedValue([[{ id: 'p1' }], 7]) });
    const repository = new ProductRepository(repo as unknown as Repository<Product>);

    const result = await repository.findPage(12, 12);

    expect(repo.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      skip: 12,
      take: 12,
    });
    expect(result).toEqual([[{ id: 'p1' }], 7]);
  });

  it('findById busca por id', async () => {
    const repo = mockRepo();
    const repository = new ProductRepository(repo as unknown as Repository<Product>);

    await repository.findById('p1');

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('findByIds busca por un conjunto de ids', async () => {
    const repo = mockRepo();
    const repository = new ProductRepository(repo as unknown as Repository<Product>);

    await repository.findByIds(['p1', 'p2']);

    expect(repo.find).toHaveBeenCalledWith({ where: { id: expect.anything() } });
  });
});
