import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import type { DemoSession } from '../entities/demo-session.entity';

/** Forma pública de la sesión anónima; oculta `createdAt`/`lastSeenAt` (internos, no los usa el front). */
export class SessionResponse {
  @Expose()
  @ApiProperty({
    description: 'Identificador de la sesión anónima (nanoid); valor de la cookie pl_session.',
  })
  id!: string;

  static from(session: DemoSession): SessionResponse {
    return plainToInstance(SessionResponse, session, { excludeExtraneousValues: true });
  }
}
