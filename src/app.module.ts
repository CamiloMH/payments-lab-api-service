import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { NodeEnv } from '@/domain';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppThrottlerGuard } from './common/throttling/app-throttler.guard';
import { GLOBAL_THROTTLERS } from './common/throttling/throttle.const';
import { CallbackPivotsModule } from './callback-pivots/callback-pivots.module';
import { CardsModule } from './cards/cards.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { DomainEventsModule } from './common/events/domain-events.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestTraceInterceptor } from './common/interceptors/request-trace.interceptor';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { OrderEventsModule } from './order-events/order-events.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentTracesModule } from './payment-traces/payment-traces.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SessionModule } from './session/session.module';
import { StockModule } from './stock/stock.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    RealtimeModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: GLOBAL_THROTTLERS,
      // En los tests (e2e incluidos) se omite: disparan muchas requests desde la
      // misma IP y dispararían 429 falsos. En dev/prod el rate-limit está activo.
      skipIf: () => process.env.NODE_ENV === NodeEnv.Test,
    }),
    TerminusModule,
    DatabaseModule,
    SessionModule,
    ProductsModule,
    StockModule,
    CartModule,
    OrderEventsModule,
    OrdersModule,
    PaymentsModule,
    PaymentTracesModule,
    CallbackPivotsModule,
    CardsModule,
    CheckoutModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestTraceInterceptor },
  ],
})
export class AppModule {}
