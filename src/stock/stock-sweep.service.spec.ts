import { Logger } from '@nestjs/common';

import { StockSweepService } from './stock-sweep.service';
import type { StockReservationService } from './stock-reservation.service';

describe('StockSweepService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delega la expiración de reservas vencidas al StockReservationService', async () => {
    const stockReservationService = {
      expireDueReservations: jest.fn().mockResolvedValue(3),
    } as unknown as StockReservationService;
    const service = new StockSweepService(stockReservationService);

    await service.sweep();

    expect(stockReservationService.expireDueReservations).toHaveBeenCalledTimes(1);
  });

  it('no registra nada si no había reservas vencidas', async () => {
    const stockReservationService = {
      expireDueReservations: jest.fn().mockResolvedValue(0),
    } as unknown as StockReservationService;
    const service = new StockSweepService(stockReservationService);

    await service.sweep();

    expect(Logger.prototype.debug).not.toHaveBeenCalled();
  });

  it('no propaga si expireDueReservations falla (el cron no debe morir)', async () => {
    const stockReservationService = {
      expireDueReservations: jest.fn().mockRejectedValue(new Error('db caída')),
    } as unknown as StockReservationService;
    const service = new StockSweepService(stockReservationService);

    await expect(service.sweep()).resolves.toBeUndefined();
  });

  it('registra el valor lanzado tal cual cuando el fallo no es una instancia de Error', async () => {
    const stockReservationService = {
      expireDueReservations: jest.fn().mockRejectedValue('fallo-no-error'),
    } as unknown as StockReservationService;
    const service = new StockSweepService(stockReservationService);

    await service.sweep();

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Fallo el sweep de reservas de stock',
      'fallo-no-error',
    );
  });
});
