import 'reflect-metadata';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SESSION_COOKIE_NAME } from '@/domain';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '@/app.module';

/**
 * El orquestador (Render) pinguea `/healthz` cada pocos segundos sin cookies.
 * Si `SessionMiddleware` corriera ahí, cada ping crearía una fila nueva en
 * `demo_sessions` para siempre, agotando el free tier de la base. Verifica
 * que la ruta quede excluida del middleware de sesión.
 */
describe('GET /healthz no crea sesión (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['healthz'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('no setea la cookie de sesión', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))).toBe(false);
  });
});
