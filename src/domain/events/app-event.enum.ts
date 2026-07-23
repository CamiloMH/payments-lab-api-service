/**
 * Nombres de los eventos de dominio internos (in-process, vía
 * `@nestjs/event-emitter`). Desacoplan los servicios core de sus consumidores
 * (audit log, trazas, WebSocket): el emisor solo publica el evento y los
 * listeners de cada feature module reaccionan, sin inyección directa.
 *
 * Distintos de `WsEvent` (los nombres que viajan al cliente por socket.io).
 */
export enum AppEvent {
  /** Una orden cambió de estado (alimenta el audit log). */
  OrderTransitioned = 'order.transitioned',
  /** Una orden llegó a un estado terminal de pago (paid/failed/refunded) → push WS. */
  OrderSettled = 'order.settled',
  /** Ocurrió una interacción con un PSP que debe registrarse en la bitácora de trazas. */
  PaymentTraced = 'payment.traced',
  /** Se inscribió una tarjeta Oneclick → push WS a la sesión. */
  CardEnrolled = 'card.enrolled',
  /** Cambió el stock disponible de un producto → push WS a la tienda. */
  StockChanged = 'stock.changed',
}
