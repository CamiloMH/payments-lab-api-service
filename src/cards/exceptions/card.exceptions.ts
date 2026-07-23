import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** No existe una tarjeta inscrita con el id indicado. */
export class CardNotFoundException extends AppException {
  constructor(cardId: string) {
    super(HttpStatus.NOT_FOUND, AppErrorCode.CardNotFound, `Tarjeta ${cardId} no encontrada`);
  }
}

/** La tarjeta existe pero está inscrita en otra sesión. */
export class CardNotOwnedException extends AppException {
  constructor() {
    super(HttpStatus.FORBIDDEN, AppErrorCode.CardNotOwned, 'Esta tarjeta no pertenece a tu sesión');
  }
}

/** El proveedor de pago exige una tarjeta inscrita (`cardId`) y el checkout no la envió. */
export class CardRequiredException extends AppException {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      AppErrorCode.CardRequired,
      'Oneclick requiere una tarjeta inscrita (cardId)',
    );
  }
}
