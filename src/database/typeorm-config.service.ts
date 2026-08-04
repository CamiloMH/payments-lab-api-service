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
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST') ?? 'localhost',
      port: Number(this.configService.get<string>('DB_PORT') ?? 5432),
      username: this.configService.get<string>('DB_USER') ?? 'root',
      password: this.configService.get<string>('DB_PASSWORD') ?? '',
      database: this.configService.get<string>('DB_NAME') ?? 'payments_lab',
      // Neon (y la mayoría de los Postgres administrados) exige TLS y se sirve
      // detrás de un pooler cuyo certificado no siempre valida en cadena contra
      // los CA raíz que trae Node; `rejectUnauthorized: false` sigue cifrando la
      // conexión, solo no verifica esa cadena. Apagado por defecto porque el
      // Postgres local de `docker-compose.yml` no habla TLS.
      ssl:
        this.configService.get<string>('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      synchronize: this.configService.get<string>('DB_SYNCHRONIZE') === 'true',
      logging: this.configService.get<string>('DB_LOGGING') === 'true',
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    };
  }
}
