import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';

import { Cart, CartStatus } from '../entities/cart.entity';

/** Encapsula el acceso a TypeORM para `Cart`. */
@Injectable()
export class CartRepository {
  constructor(@InjectRepository(Cart) private readonly repo: Repository<Cart>) {}

  /** El carrito `Active` de la sesión (a lo sumo uno), con sus ítems cargados. */
  findActiveBySession(sessionId: string): Promise<Cart | null> {
    return this.repo.findOne({
      where: { sessionId, status: CartStatus.Active },
      relations: { items: true },
    });
  }

  /** Construye la entidad en memoria sin persistirla (usar junto a `save`). */
  create(data: DeepPartial<Cart>): Cart {
    return this.repo.create(data);
  }

  save(cart: Cart): Promise<Cart> {
    return this.repo.save(cart);
  }

  /** Marca el carrito como usado por un checkout: ya no es el carrito Active de la sesión. */
  async markCheckedOut(cartId: string): Promise<void> {
    await this.repo.update({ id: cartId }, { status: CartStatus.CheckedOut });
  }
}
