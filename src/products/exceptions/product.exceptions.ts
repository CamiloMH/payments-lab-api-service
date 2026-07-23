import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** Uno o más ids de producto no existen en el catálogo (búsqueda individual o en lote). */
export class ProductNotFoundException extends AppException {
  constructor(productId: string | string[]) {
    const ids = Array.isArray(productId) ? productId : [productId];
    const message =
      ids.length === 1
        ? `Producto ${ids[0]} no encontrado`
        : `Productos no encontrados: ${ids.join(', ')}`;
    super(HttpStatus.NOT_FOUND, AppErrorCode.ProductNotFound, message);
  }
}
