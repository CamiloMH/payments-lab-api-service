import { GLOBAL_THROTTLERS, SENSITIVE_THROTTLE, ThrottleWindow } from './throttle.const';

describe('throttle.const', () => {
  it('define dos ventanas globales: ráfaga corta por segundo y sostenido por minuto', () => {
    expect(GLOBAL_THROTTLERS).toEqual([
      { name: ThrottleWindow.Short, ttl: 1_000, limit: 20 },
      { name: ThrottleWindow.Long, ttl: 60_000, limit: 100 },
    ]);
  });

  it('el límite sensible restringe la ventana larga a 8 por minuto', () => {
    expect(SENSITIVE_THROTTLE).toEqual({ [ThrottleWindow.Long]: { ttl: 60_000, limit: 8 } });
  });
});
