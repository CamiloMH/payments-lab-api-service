/**
 * Códigos de error estables de la API. El front discrimina errores por
 * `code`, no por `message` (en español, y por tanto frágil para lógica).
 * Renombrar un valor rompe ese contrato sin que TypeScript lo detecte;
 * de ahí el spec que fija los strings exactos.
 */
export const AppErrorCode = {
  ProductNotFound: 'PRODUCT_NOT_FOUND',
  CartEmpty: 'CART_EMPTY',
  CartItemNotFound: 'CART_ITEM_NOT_FOUND',
  InvalidQuantity: 'INVALID_QUANTITY',
  OrderNotFound: 'ORDER_NOT_FOUND',
  OrderNotOwned: 'ORDER_NOT_OWNED',
  /** La orden no está `paid`: solo se puede devolver una orden pagada, y solo una vez. */
  OrderNotRefundable: 'ORDER_NOT_REFUNDABLE',
  /** El proveedor de pago rechazó/falló la solicitud de reembolso; la orden no cambió de estado. */
  RefundFailed: 'REFUND_FAILED',
  InvalidOrderTransition: 'INVALID_ORDER_TRANSITION',
  StockInsufficient: 'STOCK_INSUFFICIENT',
  CardNotFound: 'CARD_NOT_FOUND',
  CardNotOwned: 'CARD_NOT_OWNED',
  CardRequired: 'CARD_REQUIRED',
  PivotNotFound: 'PIVOT_NOT_FOUND',
  PivotAlreadyConsumed: 'PIVOT_ALREADY_CONSUMED',
  PivotExpired: 'PIVOT_EXPIRED',
  PaymentProviderUnknown: 'PAYMENT_PROVIDER_UNKNOWN',
  /** Se invocó una operación que el proveedor de pago no soporta (invariante interna, no debería ocurrir). */
  ProviderOperationUnsupported: 'PROVIDER_OPERATION_UNSUPPORTED',
  WebhookSignatureInvalid: 'WEBHOOK_SIGNATURE_INVALID',
  /** Body inválido según el schema Zod del endpoint (400 genérico, sin `AppException` propia). */
  ValidationFailed: 'VALIDATION_FAILED',
  /** Ruta inexistente: no la lanza el dominio, la genera Nest al no matchear ningún handler. */
  RouteNotFound: 'ROUTE_NOT_FOUND',
  /** Rate-limit del `ThrottlerGuard` global. */
  TooManyRequests: 'TOO_MANY_REQUESTS',
  /** Cualquier excepción no clasificada (500 u otro status fuera del catálogo). */
  InternalError: 'INTERNAL_ERROR',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];
