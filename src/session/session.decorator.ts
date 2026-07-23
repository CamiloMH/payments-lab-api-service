import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { DemoSession } from './entities/demo-session.entity';

/** Extrae la sesión anónima resuelta por `SessionMiddleware` en el handler. */
export const CurrentSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): DemoSession => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.session as DemoSession;
  },
);
