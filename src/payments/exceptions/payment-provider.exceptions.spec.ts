import { HttpStatus } from '@nestjs/common';
import { PaymentProviderId } from '@/domain';

import { AppErrorCode } from '../../common/errors/app-error-code';
import {
  ProviderOperationUnsupportedException,
  UnknownPaymentProviderException,
} from './payment-provider.exceptions';

describe('UnknownPaymentProviderException', () => {
  it('404 con el id del proveedor en el mensaje', () => {
    const exception = new UnknownPaymentProviderException(PaymentProviderId.MercadoPagoCheckoutPro);

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.PaymentProviderUnknown,
      message: 'No hay un proveedor de pago registrado para "mercado_pago_checkout_pro"',
    });
  });
});

describe('ProviderOperationUnsupportedException', () => {
  it('500 con el detalle en el mensaje y su código propio', () => {
    const exception = new ProviderOperationUnsupportedException('operación no soportada');

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(exception.getResponse()).toStrictEqual({
      code: AppErrorCode.ProviderOperationUnsupported,
      message: 'operación no soportada',
    });
  });
});
