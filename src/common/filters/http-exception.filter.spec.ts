import {
  BadRequestException,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { AppErrorCode } from '../errors/app-error-code';
import { ProductNotFoundException } from '../../products/exceptions/product.exceptions';
import { InsufficientStockException } from '../../stock/insufficient-stock.exception';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  function buildHost(url = '/api/v1/products'): ArgumentsHost {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propaga status, code, message y details de una AppException', () => {
    const exception = new ProductNotFoundException('p1');

    filter.catch(exception, buildHost('/api/v1/products/p1'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        code: AppErrorCode.ProductNotFound,
        message: 'Producto p1 no encontrado',
        path: '/api/v1/products/p1',
      }),
    );
  });

  it('incluye details cuando la AppException los adjunta (ej. InsufficientStockException)', () => {
    const details = [{ productId: 'p1', requested: 3, available: 1 }];
    const exception = new InsufficientStockException(details);

    filter.catch(exception, buildHost('/api/v1/checkout'));

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: AppErrorCode.StockInsufficient, details }),
    );
  });

  it('no incluye details cuando la AppException no los adjunta', () => {
    const exception = new ProductNotFoundException('p1');

    filter.catch(exception, buildHost());

    const payload = jsonMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('details');
  });

  it('usa VALIDATION_FAILED como code de respaldo para un 400 sin AppException (ej. Zod)', () => {
    const exception = new BadRequestException({ message: ['name es requerido'] });

    filter.catch(exception, buildHost('/api/v1/products'));

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        code: AppErrorCode.ValidationFailed,
        message: ['name es requerido'],
      }),
    );
  });

  it('usa ROUTE_NOT_FOUND como code de respaldo para un 404 sin AppException (ruta inexistente)', () => {
    const exception = new HttpException('Cannot GET /nope', HttpStatus.NOT_FOUND);

    filter.catch(exception, buildHost('/nope'));

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: AppErrorCode.RouteNotFound, message: 'Cannot GET /nope' }),
    );
  });

  it('usa TOO_MANY_REQUESTS como code de respaldo para un 429 (throttler)', () => {
    const exception = new HttpException(
      'ThrottlerException: Too Many Requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );

    filter.catch(exception, buildHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: AppErrorCode.TooManyRequests }),
    );
  });

  it('mapea cualquier excepción no-HTTP a 500 con code INTERNAL_ERROR y registra el stack', () => {
    const exception = new Error('boom');
    const loggerSpy = jest.spyOn(Logger.prototype, 'error');

    filter.catch(exception, buildHost('/api/v1/checkout'));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: AppErrorCode.InternalError,
        message: 'Error interno del servidor',
      }),
    );
    expect(loggerSpy).toHaveBeenCalledWith(exception.stack);
  });

  it('registra el valor lanzado tal cual cuando no es una instancia de Error', () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'error');

    filter.catch('valor-no-error', buildHost());

    expect(loggerSpy).toHaveBeenCalledWith('valor-no-error');
  });

  it('conserva el código HTTP de excepciones que no son 500 fuera del catálogo estándar', () => {
    const exception = new HttpException('teapot', 418);

    filter.catch(exception, buildHost());

    expect(statusMock).toHaveBeenCalledWith(418);
  });

  it('usa INTERNAL_ERROR como code de respaldo para un status fuera del catálogo conocido', () => {
    const exception = new HttpException('custom', 599);

    filter.catch(exception, buildHost());

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: AppErrorCode.InternalError }),
    );
  });
});
