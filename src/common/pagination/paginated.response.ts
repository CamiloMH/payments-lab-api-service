import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadatos de paginación compartidos por todas las respuestas paginadas. Cada
 * respuesta concreta la extiende y agrega su propio `items` tipado (para que
 * Scalar/OpenAPI documente el tipo de elemento).
 */
export abstract class PaginatedResponse {
  @ApiProperty({
    description: 'Total de elementos que cumplen el filtro, sumando todas las páginas.',
  })
  total!: number;

  @ApiProperty({ description: 'Página actual devuelta (1-indexada).' })
  page!: number;

  @ApiProperty({ description: 'Tamaño de página aplicado.' })
  pageSize!: number;

  @ApiProperty({ description: 'Cantidad total de páginas (`ceil(total / pageSize)`).' })
  totalPages!: number;
}
