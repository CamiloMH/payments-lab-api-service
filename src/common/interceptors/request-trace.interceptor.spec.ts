import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { RequestTraceInterceptor } from './request-trace.interceptor';

describe('RequestTraceInterceptor', () => {
  function buildContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/api/v1/checkout' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
  }

  function buildHandler(observable: ReturnType<CallHandler['handle']>): CallHandler {
    return { handle: () => observable };
  }

  it('loguea la entrada con method y path', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const interceptor = new RequestTraceInterceptor();

    await lastValueFrom(interceptor.intercept(buildContext(), buildHandler(of('ok'))));

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('method: GET, path: /api/v1/checkout'),
    );
  });

  it('loguea la salida con status y duración cuando el handler resuelve', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log');
    const interceptor = new RequestTraceInterceptor();

    const result = await lastValueFrom(
      interceptor.intercept(buildContext(), buildHandler(of('payload'))),
    );

    expect(result).toBe('payload');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('status: 200'));
  });

  it('ante un error, loguea un warn y re-lanza el mismo error', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');
    const interceptor = new RequestTraceInterceptor();
    const boom = new Error('boom');

    await expect(
      lastValueFrom(interceptor.intercept(buildContext(), buildHandler(throwError(() => boom)))),
    ).rejects.toBe(boom);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/checkout'));
  });
});
