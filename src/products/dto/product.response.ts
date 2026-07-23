import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import type { ProductWithAvailability } from '../products.service';

/**
 * Forma pública de un producto. `excludeExtraneousValues: true` en `from()`
 * hace que sea *default-deny*: una columna nueva en la entidad (ej. un futuro
 * `costPriceClp` interno) no se filtra al front a menos que se agregue aquí
 * explícitamente con `@Expose()`.
 */
export class ProductResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único del producto (nanoid).' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Nombre visible del producto en el catálogo.' })
  name!: string;

  @Expose()
  @ApiProperty({ description: 'Descripción larga del producto.' })
  description!: string;

  @Expose()
  @ApiProperty({ description: 'Precio unitario en pesos chilenos (CLP).' })
  priceClp!: number;

  @Expose()
  @ApiProperty({
    description: 'URL de la imagen del producto, o `null` si no tiene una asignada.',
    nullable: true,
  })
  imageUrl!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Unidades disponibles para comprar ahora mismo (stockTotal − stockReserved).',
  })
  available!: number;

  static from(product: ProductWithAvailability): ProductResponse {
    return plainToInstance(ProductResponse, product, { excludeExtraneousValues: true });
  }
}
