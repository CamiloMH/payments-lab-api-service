# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added

- **Número de orden** legible para el usuario (`orderNumber`): aleatorio y no
  correlativo a propósito, para no permitir enumerar órdenes ajenas ni estimar
  el volumen del negocio. Se genera en el insert y se expone en la API y en Scalar.
- **Arquitectura orientada a eventos de dominio** (`@nestjs/event-emitter`):
  `DomainEventPublisher` emite `order.transitioned`, `order.settled`,
  `payment.traced`, `card.enrolled` y `stock.changed`, desacoplando el audit
  log, las trazas de pago y el push WebSocket de los servicios core.
- **Feature modules** cohesivos extraídos del antiguo `PaymentsModule`:
  `cards`, `payment-traces`, `callback-pivots`, `webhooks` y `order-events`.
- Módulo **`realtime`**: consolida los gateways en un único `RealtimeGateway`
  que solo escucha eventos de dominio (nadie lo inyecta).
- Integración de **Sentry** (`@sentry/nestjs`), inactiva sin `SENTRY_DSN`
  (silenciosa en desarrollo y tests).
- **Códigos de error personalizados** (`AppErrorCode`) para todos los errores,
  garantizados por el filtro global de excepciones.
- Script **`db:seed:fresh`**: dropea y recrea el esquema antes de sembrar, para
  un seed idempotente (el `db:seed` normal solo inserta y puede duplicar).

### Changed

- **Rate limiting por niveles** con throttlers nombrados (ventana corta y larga)
  y límites más estrictos en endpoints sensibles (checkout, tarjetas, refund y retry).
- `synchronize` de TypeORM ahora es configurable por entorno (`DB_SYNCHRONIZE`).
- Imágenes de productos de los fixtures: fotos reales (por palabra clave vía
  LoremFlickr y URLs curadas para impresora, escáner, cargador y SSD) en vez de
  placeholders aleatorios que no representaban el producto.

### Fixed

- Crash por la FK `stock_reservations → orders` en el checkout: la orden y sus
  reservas ahora se guardan en una única transacción (la orden primero).
- El timeline de la orden no registraba eventos del proveedor `stripe` por un
  enum desactualizado en `order_events.provider`.

### Removed

- Endpoint de creación de productos: la tienda demo es de solo lectura.

## [0.1.0] - 2026-07-08

### Added

- API NestJS de la tienda demo: sesión anónima, catálogo de productos, carrito
  multi-producto y checkout.
- **Reserva de stock atómica con TTL** (`StockReservationService`): lock
  pesimista ordenado por id (anti-deadlock), sweep periódico de reservas
  vencidas y stock en vivo por WebSocket (`stock.changed`).
- **Arquitectura Ports & Adapters para pagos** (`PaymentProviderPort` +
  `PaymentProviderRegistry` vía `DiscoveryService`): agregar un proveedor
  nuevo no toca código existente.
- Adaptadores de pago en **sandbox**: **Transbank Webpay Plus** (redirect),
  **Transbank Oneclick** (inscripción de tarjeta + cobro directo) y
  **Mercado Pago Checkout Pro** (preferencia + verificación activa dual).
- Patrón **callback pivot** (UUID + TTL + `consumedAt`) contra replay de
  callbacks/webhooks.
- Máquina de estados de la orden (`PendingPayment → Paid/PaymentFailed/
  Expired/Cancelled`, re-reserva o refund automático sobre reservas
  expiradas) como única fuente de verdad de las transiciones.
- Documentación interactiva con **Scalar** (`/reference`) a partir de DTOs
  Zod (`nestjs-zod`).
- **Health check** (`/healthz`) con verificación de conectividad a la base
  de datos vía `@nestjs/terminus`.
- **Rate limiting** global con `@nestjs/throttler`.
- Suite de tests con **cobertura ≥ 95 %** sobre la lógica de negocio
  (servicios, adaptadores de pago, máquina de estados) y **tests e2e**
  contra MariaDB real, incluida la concurrencia de reservas de stock.
- **Git hooks** (Husky + lint-staged + commitlint) y `Dockerfile` +
  `docker-compose.prod.yml` para desplegar en un EC2 detrás de Caddy.
