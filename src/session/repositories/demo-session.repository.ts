import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';

import { DemoSession } from '../entities/demo-session.entity';

/** Encapsula el acceso a TypeORM para `DemoSession`. */
@Injectable()
export class DemoSessionRepository {
  constructor(@InjectRepository(DemoSession) private readonly repo: Repository<DemoSession>) {}

  findById(id: string): Promise<DemoSession | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Construye la entidad en memoria sin persistirla (usar junto a `save`). */
  create(data: DeepPartial<DemoSession> = {}): DemoSession {
    return this.repo.create(data);
  }

  save(session: DemoSession): Promise<DemoSession> {
    return this.repo.save(session);
  }
}
