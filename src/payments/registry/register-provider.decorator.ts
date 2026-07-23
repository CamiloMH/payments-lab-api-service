import { SetMetadata } from '@nestjs/common';
import type { PaymentProviderId } from '@/domain';

/** Clave de metadata (Symbol para evitar colisiones con otra metadata de Nest). */
export const PAYMENT_PROVIDER_METADATA = Symbol('PAYMENT_PROVIDER');

/**
 * Marca una clase como implementación de `PaymentProviderPort` para el id
 * dado. `PaymentProviderRegistry` la descubre automáticamente vía
 * `DiscoveryService`; no hace falta registrarla a mano en ningún lugar más
 * que en los `imports` de su propio módulo.
 */
export const RegisterPaymentProvider = (id: PaymentProviderId): ClassDecorator =>
  SetMetadata(PAYMENT_PROVIDER_METADATA, id);
