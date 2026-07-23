import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: '.env' });

/**
 * DataSource usado por el CLI de TypeORM para generar/ejecutar migraciones y
 * por `typeorm-fixtures-cli` para el seed. Se carga fuera del DI de Nest.
 */
export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'payments_lab',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
