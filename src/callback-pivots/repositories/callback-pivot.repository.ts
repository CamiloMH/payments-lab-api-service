import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';

import { CallbackPivot } from '../entities/callback-pivot.entity';

/** Encapsula el acceso a TypeORM para `CallbackPivot`. */
@Injectable()
export class CallbackPivotRepository {
  constructor(@InjectRepository(CallbackPivot) private readonly repo: Repository<CallbackPivot>) {}

  findById(id: string): Promise<CallbackPivot | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Construye la entidad en memoria sin persistirla (usar junto a `save`). */
  create(data: DeepPartial<CallbackPivot>): CallbackPivot {
    return this.repo.create(data);
  }

  save(pivot: CallbackPivot): Promise<CallbackPivot> {
    return this.repo.save(pivot);
  }
}
