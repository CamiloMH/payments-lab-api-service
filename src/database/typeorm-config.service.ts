import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

/**
 * Factory de configuración TypeORM para el runtime de NestJS. `synchronize` se
 * controla con la variable `DB_SYNCHRONIZE` (solo el valor `"true"` lo activa) y
 * es una comodidad para desarrollo local. En producción debe quedar en `false`
 * y gobernar el esquema con las migraciones versionadas en `database/migrations/`.
 */
@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'mariadb',
      host: this.configService.get<string>('DB_HOST') ?? 'localhost',
      port: Number(this.configService.get<string>('DB_PORT') ?? 3306),
      username: this.configService.get<string>('DB_USER') ?? 'root',
      password: this.configService.get<string>('DB_PASSWORD') ?? '',
      database: this.configService.get<string>('DB_NAME') ?? 'payments_lab',
      synchronize: this.configService.get<string>('DB_SYNCHRONIZE') === 'true',
      logging: this.configService.get<string>('DB_LOGGING') === 'true',
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    };
  }
}
