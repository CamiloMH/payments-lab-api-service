import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, plainToInstance } from 'class-transformer';
import type { OrderItem } from '../entities/order-item.entity';

/**
 * Forma pública de una línea de orden: el snapshot de producto (nombre y
 * precio al momento de la compra) más la cantidad. Oculta el `orderId`
 * interno (redundante: ya viaja anidado dentro de `OrderResponse.items`).
 */
export class OrderItemResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único de la línea de orden.' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Id del producto comprado.' })
  productId!: string;

  @Expose()
  @ApiProperty({ description: 'Nombre del producto al momento de la compra (snapshot).' })
  productName!: string;

  @Expose()
  @ApiProperty({ description: 'Precio unitario en CLP al momento de la compra (snapshot).' })
  unitPriceClp!: number;

  @Expose()
  @ApiProperty({ description: 'Unidades compradas de este producto.' })
  quantity!: number;

  /**
   * Imagen actual del producto (no es snapshot: se lee de la relación `product`,
   * que siempre existe por la FK `RESTRICT`). `null` si el producto no tiene
   * imagen o la relación no vino cargada; el front cae a un placeholder.
   */
  @Expose()
  @Transform(({ obj }) => (obj as OrderItem).product?.imageUrl ?? null)
  @ApiProperty({
    nullable: true,
    description: 'URL de la imagen del producto, o `null` si no tiene.',
  })
  imageUrl!: string | null;

  static from(item: OrderItem): OrderItemResponse {
    return plainToInstance(OrderItemResponse, item, { excludeExtraneousValues: true });
  }
}
