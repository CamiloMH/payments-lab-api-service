import { Injectable, Logger } from '@nestjs/common';

import { formatLogFields } from '../common/logging/format-log-fields';
import { ProductNotFoundException } from '../products/exceptions/product.exceptions';
import { ProductRepository } from '../products/repositories/product.repository';
import { CartItemNotFoundException, InvalidQuantityException } from './exceptions/cart.exceptions';
import { CartItemRepository } from './repositories/cart-item.repository';
import { CartRepository } from './repositories/cart.repository';
import { Cart, CartStatus } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';

/**
 * Carrito server-side por sesión: es el input directo del checkout, así que
 * cada mutación valida contra el catálogo real (no confía en datos del cliente).
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly carts: CartRepository,
    private readonly cartItems: CartItemRepository,
    private readonly products: ProductRepository,
  ) {}

  /** Devuelve el carrito Active de la sesión, creándolo si no existe. */
  async getActiveCart(sessionId: string): Promise<Cart> {
    const existing = await this.carts.findActiveBySession(sessionId);
    if (existing) return existing;

    const cart = this.carts.create({ sessionId, status: CartStatus.Active });
    return this.carts.save(cart);
  }

  /** Agrega `quantity` unidades de `productId`; si ya estaba en el carrito, suma. */
  async addItem(sessionId: string, productId: string, quantity: number): Promise<CartItem> {
    this.logger.log(formatLogFields({ sessionId, productId, quantity }));

    if (quantity <= 0) {
      throw new InvalidQuantityException();
    }

    // findById y getActiveCart no dependen entre sí: se resuelven en paralelo.
    const [product, cart] = await Promise.all([
      this.products.findById(productId),
      this.getActiveCart(sessionId),
    ]);
    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    const existingItem = await this.cartItems.findByCartAndProduct(cart.id, productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      return this.cartItems.save(existingItem);
    }

    const item = this.cartItems.create({ cartId: cart.id, productId, quantity });
    return this.cartItems.save(item);
  }

  /** Fija la cantidad exacta de un ítem; 0 lo elimina del carrito. */
  async setItemQuantity(
    sessionId: string,
    productId: string,
    quantity: number,
  ): Promise<CartItem | null> {
    this.logger.log(formatLogFields({ sessionId, productId, quantity }));

    const cart = await this.getActiveCart(sessionId);
    const item = await this.cartItems.findByCartAndProduct(cart.id, productId);
    if (!item) {
      throw new CartItemNotFoundException(productId);
    }

    if (quantity <= 0) {
      await this.cartItems.deleteById(item.id);
      return null;
    }

    item.quantity = quantity;
    return this.cartItems.save(item);
  }

  async removeItem(sessionId: string, productId: string): Promise<void> {
    this.logger.log(formatLogFields({ sessionId, productId }));

    const cart = await this.getActiveCart(sessionId);
    const item = await this.cartItems.findByCartAndProduct(cart.id, productId);
    if (!item) {
      throw new CartItemNotFoundException(productId);
    }
    await this.cartItems.deleteById(item.id);
  }

  /** Marca el carrito como usado por un checkout: ya no es el carrito Active de la sesión. */
  async markCheckedOut(cartId: string): Promise<void> {
    this.logger.log(formatLogFields({ cartId }));
    await this.carts.markCheckedOut(cartId);
  }
}
