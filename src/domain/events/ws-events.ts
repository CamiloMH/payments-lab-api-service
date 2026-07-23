/** Nombres de eventos emitidos por el gateway WebSocket de la API. */
export enum WsEvent {
  StockChanged = 'stock.changed',
  /** Una orden quedó resuelta (paid/payment_failed/refunded): reemplaza el polling de `getOrder`. */
  OrderSettled = 'order.settled',
  /** Una tarjeta Oneclick quedó inscrita: reemplaza el polling de `listCards`. */
  CardEnrolled = 'card.enrolled',
}

/** Rooms de socket.io. Además de estas fijas, hay rooms dinámicas `order:{id}` y `session:{id}`. */
export enum WsRoom {
  Store = 'store',
}

/** Prefijos de rooms dinámicas por entidad (para dirigir el push al cliente correcto). */
export const WsRoomPrefix = {
  Order: 'order:',
  Session: 'session:',
} as const;

/** Mensajes que el cliente envía para unirse a una room dinámica. */
export enum WsJoinMessage {
  JoinStore = 'join:store',
  JoinOrder = 'join:order',
  JoinSession = 'join:session',
}

export interface StockChangedPayload {
  productId: string;
  available: number;
  occurredAt: string;
}

/** Estado terminal de la orden tras confirmarse el pago (mismo string que `OrderStatus`). */
export interface OrderSettledPayload {
  orderId: string;
  status: string;
  occurredAt: string;
}

export interface CardEnrolledPayload {
  cardId: string;
  cardType: string;
  cardLast4: string;
  occurredAt: string;
}
