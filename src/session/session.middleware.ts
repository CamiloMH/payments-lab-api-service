import { Injectable, type NestMiddleware } from '@nestjs/common';
import { SESSION_COOKIE_NAME } from '@/domain';
import type { NextFunction, Request, Response } from 'express';

import { DemoSession } from './entities/demo-session.entity';
import { SessionService } from './session.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- patrón oficial de @types/express para augmentar Request
  namespace Express {
    interface Request {
      session?: DemoSession;
    }
  }
}

const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
/** Same-site laxo: la cookie viaja en navegaciones top-level cross-site (ej. redirect de un PSP), no en fetch/XHR de terceros. */
const SESSION_COOKIE_SAME_SITE = 'lax' as const;

/**
 * Resuelve la sesión anónima del visitante en cada request, la expone en
 * `req.session` (leída por `@CurrentSession()`) y refresca la cookie
 * httpOnly. Si la cookie no existe o quedó obsoleta, `SessionService` crea
 * una sesión nueva de forma transparente.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const cookieValue = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const session = await this.sessionService.findOrCreate(cookieValue);

    req.session = session;
    res.cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      sameSite: SESSION_COOKIE_SAME_SITE,
      maxAge: COOKIE_MAX_AGE_MS,
    });

    next();
  }
}
