import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** No existe un pivot de callback con el id indicado. */
export class PivotNotFoundException extends AppException {
  constructor(pivotId: string) {
    super(HttpStatus.NOT_FOUND, AppErrorCode.PivotNotFound, `Pivot ${pivotId} no encontrado`);
  }
}

/** El pivot ya fue consumido por un callback anterior (protege contra replay). */
export class PivotAlreadyConsumedException extends AppException {
  constructor() {
    super(HttpStatus.GONE, AppErrorCode.PivotAlreadyConsumed, 'Este pivot ya fue consumido');
  }
}

/** El pivot superó su TTL antes de que el PSP llamara al callback. */
export class PivotExpiredException extends AppException {
  constructor() {
    super(HttpStatus.GONE, AppErrorCode.PivotExpired, 'Este pivot expiró');
  }
}
