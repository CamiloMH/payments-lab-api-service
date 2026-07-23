import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../common/errors/app-error-code';
import { AppException } from '../common/errors/app.exception';

/** Detalle de un producto sin stock suficiente para la cantidad solicitada. */
export interface InsufficientStockDetail {
  productId: string;
  requested: number;
  available: number;
}

/** Lanzada cuando `reserveAtomic` no puede cubrir la cantidad pedida de uno o más productos. */
export class InsufficientStockException extends AppException {
  constructor(public readonly details: InsufficientStockDetail[]) {
    super(
      HttpStatus.CONFLICT,
      AppErrorCode.StockInsufficient,
      'Stock insuficiente para uno o más productos',
      details,
    );
  }
}
