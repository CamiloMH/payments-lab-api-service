import { SESSION_COOKIE_NAME } from '@/domain';
import type { Request, Response } from 'express';

import { DemoSession } from './entities/demo-session.entity';
import { SessionMiddleware } from './session.middleware';
import type { SessionService } from './session.service';

describe('SessionMiddleware', () => {
  function buildRequest(cookieValue?: string): Request {
    return {
      cookies: cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {},
    } as unknown as Request;
  }

  function buildResponse(): Response {
    return { cookie: jest.fn() } as unknown as Response;
  }

  it('resuelve la sesión a partir de la cookie y la expone en req.session', async () => {
    const session = { id: 'abc' } as DemoSession;
    const sessionService = {
      findOrCreate: jest.fn().mockResolvedValue(session),
    } as unknown as SessionService;
    const middleware = new SessionMiddleware(sessionService);
    const req = buildRequest('abc');
    const res = buildResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(sessionService.findOrCreate).toHaveBeenCalledWith('abc');
    expect(req.session).toBe(session);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('llama a findOrCreate con undefined si no hay cookie', async () => {
    const session = { id: 'new-one' } as DemoSession;
    const sessionService = {
      findOrCreate: jest.fn().mockResolvedValue(session),
    } as unknown as SessionService;
    const middleware = new SessionMiddleware(sessionService);
    const req = buildRequest(undefined);
    const res = buildResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(sessionService.findOrCreate).toHaveBeenCalledWith(undefined);
  });

  it('setea la cookie httpOnly con el id de la sesión resuelta', async () => {
    const session = { id: 'resolved-id' } as DemoSession;
    const sessionService = {
      findOrCreate: jest.fn().mockResolvedValue(session),
    } as unknown as SessionService;
    const middleware = new SessionMiddleware(sessionService);
    const req = buildRequest();
    const res = buildResponse();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'resolved-id',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });
});
