import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';

import { Product } from '../entities/product.entity';

/**
 * Encapsula el acceso a TypeORM para `Product`. Expone métodos con nombre e
 * intención propios en vez de que cada servicio arme sus propios `where`.
 *
 * Los métodos que reciben un `EntityManager` (`lockManyForUpdate`,
 * `saveWithManager`) son los únicos que se usan dentro de una transacción de
 * `StockReservationService`; deben ejecutarse contra el manager transaccional,
 * nunca contra el repositorio "suelto", o perderían el lock/atomicidad.
 */
@Injectable()
export class ProductRepository {
  constructor(@InjectRepository(Product) private readonly repo: Repository<Product>) {}

  /** Catálogo completo, más recientes primero. */
  findAll(): Promise<Product[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  /** Una página del catálogo (más recientes primero) junto al total de productos. */
  findPage(offset: number, limit: number): Promise<[Product[], number]> {
    return this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: offset, take: limit });
  }

  /** Un producto por id, o `null` si no existe (incluye soft-deleted según el repo por defecto: no). */
  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Todos los productos cuyo id esté en `ids` (usado para cargar el snapshot del carrito en el checkout). */
  findByIds(ids: string[]): Promise<Product[]> {
    return this.repo.find({ where: { id: In(ids) } });
  }

  /**
   * `SELECT ... FOR UPDATE` ordenado por id ascendente (anti-deadlock) dentro
   * de una transacción activa. Núcleo de la reserva de stock atómica.
   */
  lockManyForUpdate(ids: string[], manager: EntityManager): Promise<Product[]> {
    return manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...ids)', { ids })
      .orderBy('product.id', 'ASC')
      .getMany();
  }

  /** Guarda `product` dentro de la transacción de `manager` (no usar fuera de una transacción de stock). */
  saveWithManager(product: Product, manager: EntityManager): Promise<Product> {
    return manager.save(Product, product);
  }
}
