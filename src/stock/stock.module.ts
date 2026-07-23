import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { StockReservation } from './entities/stock-reservation.entity';
import { StockReservationRepository } from './repositories/stock-reservation.repository';
import { StockReservationService } from './stock-reservation.service';
import { StockSweepService } from './stock-sweep.service';

/**
 * Reservas de stock con TTL y el sweep de expiración. Los cambios de stock se
 * publican como `AppEvent.StockChanged`; el push WebSocket lo hace `RealtimeModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Product, StockReservation])],
  providers: [
    StockReservationService,
    StockSweepService,
    ProductRepository,
    StockReservationRepository,
  ],
  exports: [StockReservationService],
})
export class StockModule {}
