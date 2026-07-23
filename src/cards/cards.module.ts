import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CallbackPivotsModule } from '../callback-pivots/callback-pivots.module';
import { PaymentsModule } from '../payments/payments.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { InscribedCard } from './entities/inscribed-card.entity';
import { InscribedCardRepository } from './repositories/inscribed-card.repository';

/**
 * Ciclo de vida de tarjetas Oneclick (inscribir, listar, eliminar). Se apoya en
 * `PaymentsModule` para el registry de proveedores y los pivots de callback, y
 * publica `AppEvent.CardEnrolled` al inscribir (el push WebSocket lo hace
 * `RealtimeModule`). Exporta el repositorio para el checkout con tarjeta guardada.
 */
@Module({
  imports: [TypeOrmModule.forFeature([InscribedCard]), PaymentsModule, CallbackPivotsModule],
  controllers: [CardsController],
  providers: [CardsService, InscribedCardRepository],
  exports: [CardsService, InscribedCardRepository],
})
export class CardsModule {}
