import 'dotenv/config';

import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { NodeEnv } from './domain/enums/node-env.enum';

/**
 * Inicialización de Sentry. DEBE importarse antes que cualquier otro módulo de
 * la app (primer import de `main.ts`) para que la instrumentación envuelva
 * NestJS/HTTP correctamente. Solo se activa si hay `SENTRY_DSN`: en dev/test
 * sin DSN queda inerte (sin ruido ni envíos). `dotenv/config` carga el `.env`
 * antes del init porque esto corre fuera del `ConfigModule` de Nest.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '1.0'),
    environment: process.env.NODE_ENV ?? NodeEnv.Development,
  });
}
