import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentTrace } from './entities/payment-trace.entity';
import { PaymentTraceListener } from './listeners/payment-trace.listener';
import { PaymentTraceRepository } from './repositories/payment-trace.repository';
import { PaymentTraceService } from './payment-trace.service';

/**
 * Bitácora de trazabilidad de pagos. Persiste una traza por cada interacción
 * con un PSP escuchando `AppEvent.PaymentTraced` (`PaymentTraceListener`), sin
 * que los servicios de pago la conozcan. Exporta `PaymentTraceService` para las
 * lecturas (detalle/lista de órdenes y el endpoint de bitácora).
 */
@Module({
  imports: [TypeOrmModule.forFeature([PaymentTrace])],
  providers: [PaymentTraceRepository, PaymentTraceService, PaymentTraceListener],
  exports: [PaymentTraceService],
})
export class PaymentTracesModule {}
