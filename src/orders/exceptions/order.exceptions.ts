import { HttpStatus } from '@nestjs/common';
import type { OrderStatus } from '@/domain';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AppException } from '../../common/errors/app.exception';

/** No existe una orden con el id indicado. */
export class OrderNotFoundException extends AppException {
  constructor(orderId: string) {
    super(HttpStatus.NOT_FOUND, AppErrorCode.OrderNotFound, `Orden ${orderId} no encontrada`);
  }
}

/** La orden existe pero pertenece a otra sesión. */
export class OrderNotOwnedException extends AppException {
  constructor() {
    super(HttpStatus.FORBIDDEN, AppErrorCode.OrderNotOwned, 'Esta orden no pertenece a tu sesión');
  }
}

/** Traducción HTTP de `InvalidOrderTransitionError` del dominio (paquete agnóstico de HTTP). */
export class InvalidOrderTransitionException extends AppException {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(
      HttpStatus.CONFLICT,
      AppErrorCode.InvalidOrderTransition,
      `Transición de orden inválida: ${from} -> ${to}`,
    );
  }
}

/** Solo se puede devolver una orden `paid`; `refunded` es terminal (idempotencia del endpoint de refund). */
export class OrderNotRefundableException extends AppException {
  constructor(currentStatus: OrderStatus) {
    super(
      HttpStatus.CONFLICT,
      AppErrorCode.OrderNotRefundable,
      `Solo se puede devolver una orden pagada (estado actual: ${currentStatus})`,
    );
  }
}

/** El proveedor de pago rechazó/falló la solicitud de reembolso; la orden queda sin modificar. */
export class RefundFailedException extends AppException {
  constructor() {
    super(
      HttpStatus.BAD_GATEWAY,
      AppErrorCode.RefundFailed,
      'El proveedor de pago rechazó la solicitud de devolución',
    );
  }
}
