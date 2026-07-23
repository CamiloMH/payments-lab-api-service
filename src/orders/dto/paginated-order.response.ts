import { ApiProperty } from '@nestjs/swagger';

import { PaginatedResponse } from '../../common/pagination/paginated.response';
import { OrderResponse } from './order.response';

/** Página de órdenes de la sesión: las órdenes de la página más los metadatos de paginación. */
export class PaginatedOrderResponse extends PaginatedResponse {
  @ApiProperty({ type: [OrderResponse], description: 'Órdenes de la página actual.' })
  items!: OrderResponse[];
}
