import { Injectable, Logger } from '@nestjs/common';

import { formatLogFields } from '../common/logging/format-log-fields';
import { DemoSession } from './entities/demo-session.entity';
import { DemoSessionRepository } from './repositories/demo-session.repository';

/** Resuelve la sesión anónima de un visitante, creándola si no existe o si la cookie quedó obsoleta. */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly sessions: DemoSessionRepository) {}

  /**
   * Busca la sesión por id (ej. de la cookie). Si no se provee id, o el id no
   * existe en la BD (ej. tras un reset), crea una sesión nueva. Siempre
   * refresca `lastSeenAt` en la sesión devuelta.
   */
  async findOrCreate(sessionId: string | undefined): Promise<DemoSession> {
    const existing = sessionId ? await this.sessions.findById(sessionId) : null;

    if (!existing) {
      const created = this.sessions.create({});
      const saved = await this.sessions.save(created);
      this.logger.log(formatLogFields({ sessionId: saved.id }));
      return saved;
    }

    return this.sessions.save(existing);
  }
}
