import { ApiProperty } from '@nestjs/swagger';

import { PaginatedResponse } from '../../common/pagination/paginated.response';
import { ProductResponse } from './product.response';

/** Página del catálogo: los productos de la página más los metadatos de paginación. */
export class PaginatedProductResponse extends PaginatedResponse {
  @ApiProperty({ type: [ProductResponse], description: 'Productos de la página actual.' })
  items!: ProductResponse[];
}
