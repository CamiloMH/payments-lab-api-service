import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import type { InscribedCard } from '../entities/inscribed-card.entity';

/**
 * Forma pública de una tarjeta inscrita. Oculta `tbkUser` (el identificador
 * que Transbank usa para autorizar cobros Oneclick) y `sessionId`.
 */
export class InscribedCardResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único de la tarjeta inscrita.' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Tipo de tarjeta informado por Transbank (ej. "Visa").' })
  cardType!: string;

  @Expose()
  @ApiProperty({ description: 'Últimos 4 dígitos de la tarjeta.' })
  cardLast4!: string;

  static from(card: InscribedCard): InscribedCardResponse {
    return plainToInstance(InscribedCardResponse, card, { excludeExtraneousValues: true });
  }
}
