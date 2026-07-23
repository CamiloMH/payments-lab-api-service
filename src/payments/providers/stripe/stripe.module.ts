import { Module } from '@nestjs/common';

import { StripeProvider } from './stripe.provider';

/** Registra el adaptador Stripe (Checkout Session). Se descubre vía `@RegisterPaymentProvider`. */
@Module({
  providers: [StripeProvider],
})
export class StripeModule {}
