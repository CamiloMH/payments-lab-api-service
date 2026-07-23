import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CardStatus } from '@/domain';
import type { DeepPartial, Repository } from 'typeorm';

import { InscribedCard } from '../entities/inscribed-card.entity';

/** Encapsula el acceso a TypeORM para `InscribedCard`. */
@Injectable()
export class InscribedCardRepository {
  constructor(@InjectRepository(InscribedCard) private readonly repo: Repository<InscribedCard>) {}

  /** Tarjetas activas de una sesión (excluye las eliminadas). */
  findActiveBySession(sessionId: string): Promise<InscribedCard[]> {
    return this.repo.find({ where: { sessionId, status: CardStatus.Active } });
  }

  findById(id: string): Promise<InscribedCard | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Tarjeta por id, validando que pertenezca a la sesión (evita usar tarjetas de otra sesión en el checkout). */
  findByIdAndSession(id: string, sessionId: string): Promise<InscribedCard | null> {
    return this.repo.findOne({ where: { id, sessionId } });
  }

  /** Construye la entidad en memoria sin persistirla (usar junto a `save`). */
  create(data: DeepPartial<InscribedCard>): InscribedCard {
    return this.repo.create(data);
  }

  save(card: InscribedCard): Promise<InscribedCard> {
    return this.repo.save(card);
  }
}
