import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';

import { CartItem } from '../entities/cart-item.entity';

/** Encapsula el acceso a TypeORM para `CartItem`. */
@Injectable()
export class CartItemRepository {
  constructor(@InjectRepository(CartItem) private readonly repo: Repository<CartItem>) {}

  /** El ítem de un producto dentro de un carrito, o `null` si no está agregado. */
  findByCartAndProduct(cartId: string, productId: string): Promise<CartItem | null> {
    return this.repo.findOne({ where: { cartId, productId } });
  }

  /** Construye la entidad en memoria sin persistirla (usar junto a `save`). */
  create(data: DeepPartial<CartItem>): CartItem {
    return this.repo.create(data);
  }

  save(item: CartItem): Promise<CartItem> {
    return this.repo.save(item);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
