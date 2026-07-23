import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SessionResponse } from './dto/session.response';
import { DemoSession } from './entities/demo-session.entity';
import { CurrentSession } from './session.decorator';

/**
 * Sesión anónima: identidad de un visitante sin login, resuelta por
 * `SessionMiddleware` en cada request a partir de la cookie httpOnly
 * `pl_session` (o creada si no existe todavía).
 */
@ApiTags('session')
@Controller({ path: 'session', version: '1' })
export class SessionController {
  @Get()
  @ApiOperation({
    summary: 'Sesión anónima actual',
    description:
      'Devuelve la sesión resuelta para esta request. `SessionMiddleware` ya la creó o ' +
      'reutilizó antes de llegar aquí, seteando la cookie `pl_session` (httpOnly, SameSite=Lax) ' +
      'si hacía falta.',
  })
  @ApiResponse({ status: 200, description: 'Sesión anónima activa.', type: SessionResponse })
  getCurrent(@CurrentSession() session: DemoSession): SessionResponse {
    return SessionResponse.from(session);
  }
}
