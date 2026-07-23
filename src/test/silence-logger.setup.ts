import { Logger } from '@nestjs/common';

/**
 * Silencia los logs de trazabilidad (`log`/`debug`/`warn`) en todos los
 * specs: son ruido de consola en los tests, no comportamiento bajo prueba.
 * `error` queda fuera a propósito: algunos specs (`http-exception.filter`,
 * `stock-sweep.service`) ya lo espían explícitamente para asertar sobre él.
 */
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});
