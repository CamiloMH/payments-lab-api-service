import { HttpStatus } from '@nestjs/common';
import type { PaymentProviderId } from '@/domain';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** Se resolvió un `PaymentProviderId` sin adaptador registrado (`@RegisterPaymentProvider`). */
export class UnknownPaymentProviderException extends AppException {
  constructor(id: PaymentProviderId) {
    super(
      HttpStatus.NOT_FOUND,
      AppErrorCode.PaymentProviderUnknown,
      `No hay un proveedor de pago registrado para "${id}"`,
    );
  }
}

/**
 * Se invocó sobre un proveedor una operación que no soporta (por ejemplo, el
 * callback de retorno en Oneclick, que es cobro directo y no redirige). Es una
 * invariante interna: si aparece, hay un ruteo o un uso incorrecto del puerto.
 */
export class ProviderOperationUnsupportedException extends AppException {
  constructor(detail: string) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, AppErrorCode.ProviderOperationUnsupported, detail);
  }
}
