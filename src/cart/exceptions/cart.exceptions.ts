import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** El carrito de la sesión no tiene ítems; no se puede iniciar un checkout. */
export class CartEmptyException extends AppException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, AppErrorCode.CartEmpty, 'El carrito está vacío');
  }
}

/** El producto indicado no tiene un ítem en el carrito de la sesión. */
export class CartItemNotFoundException extends AppException {
  constructor(productId: string) {
    super(
      HttpStatus.NOT_FOUND,
      AppErrorCode.CartItemNotFound,
      `El producto ${productId} no está en el carrito`,
    );
  }
}

/** La cantidad solicitada para un ítem de carrito no es un entero positivo. */
export class InvalidQuantityException extends AppException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, AppErrorCode.InvalidQuantity, 'La cantidad debe ser mayor a 0');
  }
}
