import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CallbackPivot } from './entities/callback-pivot.entity';
import { CallbackPivotRepository } from './repositories/callback-pivot.repository';
import { CallbackPivotService } from './callback-pivot.service';

/**
 * Pivots de callback: contexto efímero (con TTL e idempotencia) de un retorno
 * redirect de PSP o de una inscripción Oneclick. Infraestructura compartida por
 * el callback de pagos, el checkout y las tarjetas; exporta `CallbackPivotService`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CallbackPivot])],
  providers: [CallbackPivotRepository, CallbackPivotService],
  exports: [CallbackPivotService],
})
export class CallbackPivotsModule {}
