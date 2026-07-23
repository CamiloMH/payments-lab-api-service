# payments-lab-api-service

API REST de un **sandbox de medios de pago**: una tienda demo (sesión anónima,
catálogo, carrito y checkout) que integra varios PSP chilenos e internacionales
con flujos, estados y errores reales, sin cobrar dinero de verdad. Es el backend
del [frontend web](https://github.com/CamiloMH/payments-lab-frontend-web).

> Proyecto de portafolio. Demuestra cómo integrar medios de pago de punta a
> punta, no es un producto real.

## Características

- **Ports & Adapters para pagos**: un `PaymentProviderPort` común y un
  `PaymentProviderRegistry` (vía `DiscoveryService`); agregar un proveedor nuevo
  no toca el código existente.
- **Adaptadores en sandbox**: Transbank **Webpay Plus** (redirect), Transbank
  **Oneclick** (inscripción de tarjeta + cobro directo) y **Stripe** (Checkout
  hosted). **Mercado Pago** Checkout Pro está preparado pero deshabilitado.
- **Reserva de stock atómica con TTL**: lock pesimista ordenado por id
  (anti-deadlock), sweep de reservas vencidas y stock en vivo por WebSocket.
- **Arquitectura orientada a eventos de dominio** (`@nestjs/event-emitter`): el
  audit log, las trazas de pago y el push por WebSocket se desacoplan de los
  servicios core (`order.transitioned`, `order.settled`, `payment.traced`,
  `card.enrolled`, `stock.changed`).
- **Máquina de estados de la orden** como única fuente de verdad de las
  transiciones (`PendingPayment → Paid / PaymentFailed / Expired / Cancelled`,
  re-reserva o refund automático sobre reservas expiradas).
- **Callback pivot** (UUID + TTL + `consumedAt`) contra replay de callbacks y webhooks.
- **Número de orden** legible, aleatorio y no correlativo (no permite enumerar órdenes).
- **Rate limiting por niveles** (`@nestjs/throttler`) y **códigos de error
  personalizados** para todos los errores.
- **Sentry** para observabilidad (inactivo sin `SENTRY_DSN`).
- Documentación OpenAPI interactiva con **Scalar** en `/reference`.

## Stack

NestJS 11 · TypeScript · TypeORM + MariaDB · WebSocket (socket.io) ·
`@nestjs/event-emitter` · `@nestjs/throttler` · Scalar · Sentry · Jest · Node ≥ 24 · pnpm.

## Requisitos

- Node.js ≥ 24 y **pnpm** (este proyecto no usa npm).
- MariaDB. La forma más simple es `docker-compose` (publica el puerto 3309 hacia
  el 3306 del contenedor).

## Puesta en marcha

```bash
pnpm install
cp .env.example .env        # ajusta credenciales y claves de sandbox
docker compose up -d db     # MariaDB local (opcional si ya tienes una)
pnpm migration:run          # crea el esquema
pnpm db:seed                # carga el catálogo de productos de prueba
pnpm dev                    # API en http://localhost:3001 (watch)
```

- Documentación de la API: `http://localhost:3001/reference`
- Health check: `http://localhost:3001/healthz`

### Variables de entorno

Ver [`.env.example`](./.env.example). Las principales:

| Variable | Descripción |
| --- | --- |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexión MariaDB. |
| `DB_SYNCHRONIZE` | Debe ser `false`: el esquema lo gobiernan las migraciones. |
| `API_PORT` | Puerto de la API (por defecto `3001`). |
| `WEB_BASE_URL` | Origen del frontend permitido por CORS y destino del retorno tras un pago. |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` | Credenciales de prueba de Mercado Pago. |
| `STRIPE_SECRET_KEY` | Clave de test de Stripe (`sk_test_…`). |
| `SENTRY_DSN` | DSN de Sentry; vacío desactiva la instrumentación. |

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | Arranca la API en modo watch. |
| `pnpm build` / `pnpm start:prod` | Compila y ejecuta el build de producción. |
| `pnpm test` | Tests unitarios (Jest). |
| `pnpm test:coverage` | Tests con cobertura (umbral 95 %). |
| `pnpm test:e2e` | Tests e2e contra MariaDB real. |
| `pnpm lint` / `pnpm typecheck` | ESLint y chequeo de tipos. |
| `pnpm migration:run` / `migration:revert` / `migration:generate` | Migraciones TypeORM. |
| `pnpm db:seed` | Carga los fixtures (aditivo). |
| `pnpm db:seed:fresh` | Dropea y recrea el esquema, luego siembra (idempotente, destructivo). |
| `pnpm db:reset` | Revierte y reaplica migraciones y vuelve a sembrar. |

## Endpoints principales

Bajo el prefijo `/api/v1`:

- `GET /session` — sesión anónima (cookie).
- `GET /products`, `GET /products/:id` — catálogo paginado.
- `GET|POST|PATCH|DELETE /cart[...]` — carrito multi-producto.
- `GET /payment-methods` — métodos habilitados.
- `POST /checkout` — inicia el pago con el proveedor elegido.
- `GET /orders`, `GET /orders/:id`, `POST /orders/:id/{cancel,retry,refund}`,
  `GET /orders/:id/{timeline,traces}` — órdenes, historial y trazabilidad.
- `GET /cards`, `POST /cards/enroll`, `DELETE /cards/:id` — tarjetas Oneclick.
- Callbacks/webhooks de retorno de los PSP.

## Tests

Cobertura mínima **95 %** sobre la lógica de negocio (servicios, adaptadores de
pago, máquina de estados) más tests e2e contra MariaDB real, incluida la
concurrencia de reservas de stock. Los controllers, entidades y módulos quedan
fuera del cómputo de cobertura.

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
```

## Estructura

```
src/
  cards/          payment-traces/   callback-pivots/   webhooks/
  order-events/   orders/           payments/          stock/
  realtime/       session/          domain/            database/
  common/         health/
fixtures/         # datos de seed (catálogo)
```

## Licencia

Proyecto de portafolio de Camilo Muñoz. Uso educativo y de demostración.
