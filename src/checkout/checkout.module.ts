import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CallbackPivotsModule } from '../callback-pivots/callback-pivots.module';
import { CardsModule } from '../cards/cards.module';
import { CartModule } from '../cart/cart.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItemRepository } from '../orders/repositories/order-item.repository';
import { OrderRepository } from '../orders/repositories/order.repository';
import { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import { PaymentsModule } from '../payments/payments.module';
import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { StockModule } from '../stock/stock.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Order, OrderItem, PaymentAttempt]),
    CartModule,
    StockModule,
    PaymentsModule,
    CardsModule,
    CallbackPivotsModule,
  ],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    ProductRepository,
    OrderRepository,
    OrderItemRepository,
    PaymentAttemptRepository,
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
