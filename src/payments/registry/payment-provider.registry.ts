import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import type { PaymentMethodDescriptor, PaymentProviderId } from '@/domain';

import { UnknownPaymentProviderException } from '../exceptions/payment-provider.exceptions';
import type { PaymentProviderPort } from '../ports/payment-provider.port';
import { PAYMENT_PROVIDER_METADATA } from './register-provider.decorator';

/**
 * Descubre en el arranque todas las clases decoradas con
 * `@RegisterPaymentProvider` (vía `DiscoveryService`, sin tocar código
 * existente al agregar un PSP nuevo) y las expone por id.
 */
@Injectable()
export class PaymentProviderRegistry implements OnModuleInit {
  private readonly providers = new Map<PaymentProviderId, PaymentProviderPort>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discoveryService.getProviders()) {
      const instance = wrapper.instance as object | null | undefined;
      if (!instance || !instance.constructor) continue;

      const id = this.reflector.get(PAYMENT_PROVIDER_METADATA, instance.constructor as never) as
        PaymentProviderId | undefined;
      if (id) {
        this.providers.set(id, instance as unknown as PaymentProviderPort);
      }
    }
  }

  resolve(id: PaymentProviderId): PaymentProviderPort {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new UnknownPaymentProviderException(id);
    }
    return provider;
  }

  listDescriptors(): PaymentMethodDescriptor[] {
    return [...this.providers.values()].map((provider) => provider.describe());
  }
}
