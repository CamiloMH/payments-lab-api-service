import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderEvent } from './entities/order-event.entity';
import { OrderAuditListener } from './listeners/order-audit.listener';
import { OrderEventRepository } from './repositories/order-event.repository';
import { OrderEventService } from './order-event.service';

/**
 * Audit log del ciclo de vida de las órdenes. Persiste una entrada por cada
 * transición escuchando `AppEvent.OrderTransitioned` (`OrderAuditListener`), sin
 * que los servicios que transicionan la orden lo conozcan. Exporta
 * `OrderEventService` para la lectura del timeline.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OrderEvent])],
  providers: [OrderEventRepository, OrderEventService, OrderAuditListener],
  exports: [OrderEventService],
})
export class OrderEventsModule {}
