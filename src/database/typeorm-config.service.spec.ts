import { ConfigService } from '@nestjs/config';

import { TypeOrmConfigService } from './typeorm-config.service';

describe('TypeOrmConfigService', () => {
  function buildConfigService(values: Record<string, string>): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  it('lee host/puerto/credenciales desde ConfigService', () => {
    const service = new TypeOrmConfigService(
      buildConfigService({
        DB_HOST: 'db.internal',
        DB_PORT: '3309',
        DB_USER: 'payments',
        DB_PASSWORD: 'secret',
        DB_NAME: 'payments_lab',
        DB_LOGGING: 'true',
      }),
    );

    const options = service.createTypeOrmOptions();

    expect(options).toMatchObject({
      type: 'mariadb',
      host: 'db.internal',
      port: 3309,
      username: 'payments',
      password: 'secret',
      database: 'payments_lab',
      logging: true,
    });
  });

  it('activa synchronize solo cuando DB_SYNCHRONIZE es "true"', () => {
    const on = new TypeOrmConfigService(buildConfigService({ DB_SYNCHRONIZE: 'true' }));
    expect(on.createTypeOrmOptions().synchronize).toBe(true);

    const off = new TypeOrmConfigService(buildConfigService({ DB_SYNCHRONIZE: 'false' }));
    expect(off.createTypeOrmOptions().synchronize).toBe(false);
  });

  it('usa valores por defecto razonables si faltan variables (synchronize apagado)', () => {
    const service = new TypeOrmConfigService(buildConfigService({}));

    expect(service.createTypeOrmOptions()).toMatchObject({
      host: 'localhost',
      port: 3306,
      logging: false,
      synchronize: false,
    });
  });
});
