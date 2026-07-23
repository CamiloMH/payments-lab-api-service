import { Module } from '@nestjs/common';

import { WebpayPlusProvider } from './webpay.provider';

/** Registra el adaptador Webpay Plus. Se descubre vía `@RegisterPaymentProvider`. */
@Module({
  providers: [WebpayPlusProvider],
})
export class WebpayModule {}
