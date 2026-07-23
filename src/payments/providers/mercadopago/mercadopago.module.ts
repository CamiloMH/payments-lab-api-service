import { Module } from '@nestjs/common';

import { MercadoPagoProvider } from './mercadopago.provider';

/** Registra el adaptador Mercado Pago. Se descubre vía `@RegisterPaymentProvider`. */
@Module({
  providers: [MercadoPagoProvider],
  exports: [MercadoPagoProvider],
})
export class MercadoPagoModule {}
