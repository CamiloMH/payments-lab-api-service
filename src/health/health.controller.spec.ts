import { Test, type TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };
  let dbIndicator: { pingCheck: jest.Mock };

  beforeEach(async () => {
    healthCheckService = {
      check: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    };
    dbIndicator = { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: dbIndicator },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('incluye un ping a la base de datos entre los checks ejecutados', async () => {
    await controller.check();

    const [checks] = healthCheckService.check.mock.calls[0] as [Array<() => unknown>];
    await checks[0]();

    expect(dbIndicator.pingCheck).toHaveBeenCalledWith('database');
  });

  it('devuelve el resultado agregado del health check', async () => {
    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
  });
});
