import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('mercadopago');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mercadopago = require('mercadopago');

import { WebhookSignatureInvalidException } from '../payments/exceptions/webhook.exceptions';
import { MpWebhookGuard } from './mp-webhook.guard';

describe('MpWebhookGuard', () => {
  function buildContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function buildConfig(secret: string | undefined): ConfigService {
    return { get: () => secret } as unknown as ConfigService;
  }

  beforeEach(() => {
    (mercadopago.WebhookSignatureValidator.validate as jest.Mock).mockReset();
  });

  it('permite la request si la firma es válida', () => {
    (mercadopago.WebhookSignatureValidator.validate as jest.Mock).mockReturnValue(undefined);
    const guard = new MpWebhookGuard(buildConfig('secret-123'));
    const context = buildContext({
      headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'req-1' },
      query: { 'data.id': '555' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza con WebhookSignatureInvalidException si la firma es inválida', () => {
    (mercadopago.WebhookSignatureValidator.validate as jest.Mock).mockImplementation(() => {
      throw new mercadopago.InvalidWebhookSignatureError('SignatureMismatch');
    });
    const guard = new MpWebhookGuard(buildConfig('secret-123'));
    const context = buildContext({
      headers: { 'x-signature': 'ts=1,v1=bad', 'x-request-id': 'req-1' },
      query: { 'data.id': '555' },
    });

    expect(() => guard.canActivate(context)).toThrow(WebhookSignatureInvalidException);
  });

  it('permite la request sin validar si no hay secreto configurado (dev sin webhook secret)', () => {
    const guard = new MpWebhookGuard(buildConfig(undefined));
    const context = buildContext({ headers: {}, query: {} });

    expect(guard.canActivate(context)).toBe(true);
    expect(mercadopago.WebhookSignatureValidator.validate).not.toHaveBeenCalled();
  });
});
