import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { mapPage } from '../common/pagination/page';
import { PaginationQueryDto } from '../common/pagination/pagination.schema';
import { PaginatedProductResponse } from './dto/paginated-product.response';
import { ProductResponse } from './dto/product.response';
import { ProductsService } from './products.service';

/** Catálogo de la tienda demo. Solo lectura pública (listado paginado y detalle). */
@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista el catálogo (paginado)',
    description:
      'Devuelve una página del catálogo con `available` calculado en el momento de la consulta ' +
      '(`stockTotal − stockReserved`), reflejando reservas de checkouts en curso de otras sesiones. ' +
      'Más recientes primero.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página solicitada (1-indexada). Default 1.',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Elementos por página. Default 12, máximo 100.',
  })
  @ApiResponse({ status: 200, description: 'Página del catálogo.', type: PaginatedProductResponse })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedProductResponse> {
    const page = await this.productsService.listPage(query.page, query.pageSize);
    return mapPage(page, ProductResponse.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un producto' })
  @ApiParam({ name: 'id', description: 'Id del producto (nanoid).' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.', type: ProductResponse })
  @ApiResponse({ status: 404, description: 'No existe un producto con ese id.' })
  async findById(@Param('id') id: string): Promise<ProductResponse> {
    return ProductResponse.from(await this.productsService.findById(id));
  }
}
