import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { StockReservationService } from './stock-reservation.service';

/**
 * Barre reservas vencidas cada 30s. Es la red de seguridad detrás del
 * expiry-on-read: garantiza que el stock se libere incluso si nadie vuelve
 * a consultar el catálogo. Un error aquí no debe tumbar el proceso del cron.
 */
@Injectable()
export class StockSweepService {
  private readonly logger = new Logger(StockSweepService.name);

  constructor(private readonly stockReservationService: StockReservationService) {}

  @Cron('*/30 * * * * *')
  async sweep(): Promise<void> {
    try {
      const expiredCount = await this.stockReservationService.expireDueReservations();
      if (expiredCount > 0) {
        this.logger.debug(`Expiradas ${expiredCount} reserva(s) vencida(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Fallo el sweep de reservas de stock',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
