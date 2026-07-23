import type { ThrottlerOptions } from '@nestjs/throttler';

/** Nombres de las ventanas del rate-limit global (por IP). */
export const ThrottleWindow = {
  Short: 'short',
  Long: 'long',
} as const;

/**
 * Rate-limit global por IP (protección contra denegación de servicio): una
 * ráfaga corta por segundo más un límite sostenido por minuto. Se aplica a
 * TODA la API HTTP vía `AppThrottlerGuard` registrado como `APP_GUARD`.
 */
export const GLOBAL_THROTTLERS: ThrottlerOptions[] = [
  { name: ThrottleWindow.Short, ttl: 1_000, limit: 20 },
  { name: ThrottleWindow.Long, ttl: 60_000, limit: 100 },
];

/**
 * Límite estricto para endpoints costosos que disparan un PSP o transacciones
 * (checkout, inscripción y borrado de tarjeta, reintento y reembolso de orden):
 * baja la ventana larga a 8 por minuto, conservando la ráfaga corta global.
 * Se aplica con `@Throttle(SENSITIVE_THROTTLE)` en cada endpoint.
 */
export const SENSITIVE_THROTTLE = {
  [ThrottleWindow.Long]: { ttl: 60_000, limit: 8 },
};
