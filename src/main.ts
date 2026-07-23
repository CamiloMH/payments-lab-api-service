import './instrument';
import 'reflect-metadata';

import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module';
import { DEFAULT_PUBLIC_API_URL, DEFAULT_WEB_BASE_URL } from './common/config.defaults';

/** Tags de la documentación OpenAPI, en el orden en que se navega la demo. */
const API_TAGS: ReadonlyArray<{ name: string; description: string }> = [
  {
    name: 'session',
    description: 'Identidad anónima del visitante (cookie httpOnly `pl_session`), sin login.',
  },
  {
    name: 'products',
    description: 'Catálogo de la tienda: lectura pública y creación por visitantes.',
  },
  { name: 'cart', description: 'Carrito server-side de la sesión; input directo del checkout.' },
  {
    name: 'checkout',
    description: 'Orquesta reserva de stock, creación de la orden y el intento de pago.',
  },
  { name: 'orders', description: 'Consulta, cancelación y reintento de pago de órdenes.' },
  {
    name: 'payment-methods',
    description: 'Métodos de pago disponibles, descubiertos automáticamente vía el registry.',
  },
  {
    name: 'cards',
    description: 'Tarjetas guardadas vía Transbank Oneclick (inscribir, listar, eliminar).',
  },
  {
    name: 'health',
    description: 'Estado del servicio y de la base de datos, para orquestadores/monitoreo.',
  },
];

/**
 * Arranca la API. Convenciones:
 * - Prefijo global `api` + versionado por URI (`/api/v1/...`); `healthz` queda fuera del prefijo.
 * - `trust proxy` para que el rate-limit lea la IP real detrás de Caddy.
 * - Documentación OpenAPI generada desde los schemas Zod y servida con Scalar en `/reference`.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.set('trust proxy', 1);
  app.use(cookieParser());

  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const webOrigin = process.env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL;
  app.enableCors({ origin: [webOrigin], credentials: true });

  const publicApiUrl = process.env.PUBLIC_API_URL ?? DEFAULT_PUBLIC_API_URL;

  let documentBuilder = new DocumentBuilder()
    .setTitle('payments-lab API')
    .setDescription(
      'Tienda demo (sandbox) con integraciones de pago Webpay, Oneclick y Mercado Pago. ' +
        'Ningún endpoint mueve dinero real: todas las credenciales son de integración/sandbox. ' +
        'La identidad del cliente es una sesión anónima (cookie httpOnly `pl_session`, sin login) ' +
        'que resuelve `SessionMiddleware` en cada request; no hace falta autenticación explícita ' +
        'para probar la API, basta con mandar las cookies que devuelve `GET /session`.',
    )
    .setVersion('1.0')
    .setContact('Camilo Muñoz', 'https://camilomunoz.dev', '')
    .addServer(publicApiUrl, 'Entorno actual')
    .addCookieAuth('pl_session', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Cookie httpOnly de sesión anónima, seteada automáticamente por GET /session.',
    });

  for (const tag of API_TAGS) {
    documentBuilder = documentBuilder.addTag(tag.name, tag.description);
  }

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, documentBuilder.build()));
  app.use('/reference', apiReference({ content: document, theme: 'kepler' }));

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}`);
  logger.log(`Documentación (Scalar) en http://localhost:${port}/reference`);
}

void bootstrap();
