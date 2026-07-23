import { AppErrorCode } from './app-error-code';

/**
 * El front discrimina errores por estos strings; un rename accidental
 * rompería ese contrato sin que TypeScript lo detecte.
 */
describe('AppErrorCode', () => {
  it('fija los valores exactos del catálogo', () => {
    expect(AppErrorCode).toStrictEqual({
      ProductNotFound: 'PRODUCT_NOT_FOUND',
      CartEmpty: 'CART_EMPTY',
      CartItemNotFound: 'CART_ITEM_NOT_FOUND',
      InvalidQuantity: 'INVALID_QUANTITY',
      OrderNotFound: 'ORDER_NOT_FOUND',
      OrderNotOwned: 'ORDER_NOT_OWNED',
      OrderNotRefundable: 'ORDER_NOT_REFUNDABLE',
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
      ProviderOperationUnsupported: 'PROVIDER_OPERATION_UNSUPPORTED',
      WebhookSignatureInvalid: 'WEBHOOK_SIGNATURE_INVALID',
      ValidationFailed: 'VALIDATION_FAILED',
      RouteNotFound: 'ROUTE_NOT_FOUND',
      TooManyRequests: 'TOO_MANY_REQUESTS',
      InternalError: 'INTERNAL_ERROR',
    });
  });
});
