import { Injectable } from '@nestjs/common';

import { buildPage, pageOffset, type Page } from '../common/pagination/page';
import { Product } from './entities/product.entity';
import { ProductNotFoundException } from './exceptions/product.exceptions';
import { ProductRepository } from './repositories/product.repository';

/** Producto con su disponibilidad calculada expuesta al cliente. */
export type ProductWithAvailability = Omit<Product, 'assignId'> & { available: number };

/** Adjunta `available = stockTotal - stockReserved` a un producto. */
function withAvailability(product: Product): ProductWithAvailability {
  return { ...product, available: product.stockTotal - product.stockReserved };
}

/**
 * Lectura del catálogo demo. `stockReserved` es de solo lectura desde aquí: solo
 * `StockReservationService` lo muta, dentro de una transacción con lock.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly products: ProductRepository) {}

  /** Lista el catálogo completo (seed + creados por visitantes) con `available` calculado en el momento. */
  async list(): Promise<ProductWithAvailability[]> {
    const products = await this.products.findAll();
    return products.map(withAvailability);
  }

  /** Una página del catálogo (más recientes primero) con `available` calculado en el momento. */
  async listPage(page: number, pageSize: number): Promise<Page<ProductWithAvailability>> {
    const [products, total] = await this.products.findPage(pageOffset(page, pageSize), pageSize);
    return buildPage(products.map(withAvailability), total, page, pageSize);
  }

  /** Busca un producto por id con `available` calculado. @throws {ProductNotFoundException} si no existe. */
  async findById(id: string): Promise<ProductWithAvailability> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new ProductNotFoundException(id);
    }
    return withAvailability(product);
  }
}
