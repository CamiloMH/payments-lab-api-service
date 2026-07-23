import { Module } from '@nestjs/common';

import { OneclickProvider } from './oneclick.provider';

/** Registra el adaptador Oneclick. Se descubre vía `@RegisterPaymentProvider`. */
@Module({
  providers: [OneclickProvider],
})
export class OneclickModule {}
