import { assertOrderTransition, InvalidOrderTransitionError, type OrderStatus } from '@/domain';

import { InvalidOrderTransitionException } from '../orders/exceptions/order.exceptions';

/**
 * Wrapper HTTP-aware de `assertOrderTransition`: el dominio (paquete
 * compartido) no conoce HTTP, así que la capa de aplicación traduce
 * `InvalidOrderTransitionError` a `InvalidOrderTransitionException` (409) aquí.
 */
export function assertOrderTransitionOrConflict(from: OrderStatus, to: OrderStatus): void {
  try {
    assertOrderTransition(from, to);
  } catch (error) {
    if (error instanceof InvalidOrderTransitionError) {
      throw new InvalidOrderTransitionException(from, to);
    }
    throw error;
  }
}
