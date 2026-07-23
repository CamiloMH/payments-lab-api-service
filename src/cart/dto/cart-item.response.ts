import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import type { CartItem } from '../entities/cart-item.entity';

/** Forma pública de un ítem de carrito; oculta `cartId` (interno, no lo usa el front). */
export class CartItemResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único del ítem de carrito.' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Id del producto agregado.' })
  productId!: string;

  @Expose()
  @ApiProperty({ description: 'Unidades de este producto en el carrito.' })
  quantity!: number;

  static from(item: CartItem): CartItemResponse {
    return plainToInstance(CartItemResponse, item, { excludeExtraneousValues: true });
  }
}
