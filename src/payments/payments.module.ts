import { DiscoveryModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CallbackPivotsModule } from '../callback-pivots/callback-pivots.module';
import { Order } from '../orders/entities/order.entity';
import { OrderRepository } from '../orders/repositories/order.repository';
import { StockModule } from '../stock/stock.module';
import { PaymentAttempt } from './entities/payment-attempt.entity';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import { PaymentCallbackService } from './payment-callback.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentsController } from './payments.controller';
import { MercadoPagoModule } from './providers/mercadopago/mercadopago.module';
import { StripeModule } from './providers/stripe/stripe.module';
import { OneclickModule } from './providers/transbank-oneclick/oneclick.module';
import { WebpayModule } from './providers/transbank-webpay/webpay.module';
import { PaymentProviderRegistry } from './registry/payment-provider.registry';

/**
 * Núcleo de procesamiento de pagos: registry de proveedores (Open/Closed vía
 * `@RegisterPaymentProvider`), el callback de retorno compartido y el listado de
 * métodos. Los efectos transversales (audit log, trazas, push WebSocket) se
 * publican como eventos de dominio y los resuelven sus módulos dedicados.
 */
@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([PaymentAttempt, Order]),
    StockModule,
    CallbackPivotsModule,
    WebpayModule,
    OneclickModule,
    MercadoPagoModule,
    StripeModule,
  ],
  controllers: [PaymentsController, PaymentMethodsController],
  providers: [
    PaymentProviderRegistry,
    PaymentCallbackService,
    PaymentAttemptRepository,
    OrderRepository,
  ],
  exports: [PaymentProviderRegistry, PaymentCallbackService, PaymentAttemptRepository],
})
export class PaymentsModule {}
