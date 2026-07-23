import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import type { Cart } from '../entities/cart.entity';
import { CartItemResponse } from './cart-item.response';

/** Forma pública del carrito activo de una sesión; oculta `sessionId` (dueño) y `status` (interno). */
export class CartResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único del carrito.' })
  id!: string;

  @Expose()
  @Type(() => CartItemResponse)
  @ApiProperty({ description: 'Ítems actualmente en el carrito.', type: [CartItemResponse] })
  items!: CartItemResponse[];

  static from(cart: Cart): CartResponse {
    return plainToInstance(CartResponse, cart, { excludeExtraneousValues: true });
  }
}
