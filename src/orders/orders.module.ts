import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CheckoutModule } from '../checkout/checkout.module';
import { OrderEventsModule } from '../order-events/order-events.module';
import { PaymentTracesModule } from '../payment-traces/payment-traces.module';
import { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import { StockModule } from '../stock/stock.module';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderExpiryService } from './order-expiry.service';
import { OrderRepository } from './repositories/order.repository';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, PaymentAttempt]),
    StockModule,
    CheckoutModule,
    PaymentsModule,
    PaymentTracesModule,
    OrderEventsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRepository, OrderExpiryService, PaymentAttemptRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
