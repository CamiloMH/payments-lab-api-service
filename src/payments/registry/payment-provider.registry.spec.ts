import { PaymentProviderId } from '@/domain';
import type { DiscoveryService } from '@nestjs/core';
import type { Reflector } from '@nestjs/core';

import { UnknownPaymentProviderException } from '../exceptions/payment-provider.exceptions';
import { RegisterPaymentProvider } from './register-provider.decorator';
import { PaymentProviderRegistry } from './payment-provider.registry';

@RegisterPaymentProvider(PaymentProviderId.TransbankWebpayPlus)
class FakeWebpayProvider {
  readonly id = PaymentProviderId.TransbankWebpayPlus;
  describe() {
    return {
      id: PaymentProviderId.TransbankWebpayPlus,
      labelKey: 'paymentMethods.webpay',
      requiresInscribedCard: false,
      supportsRefund: true,
    };
  }
}

class NotAProvider {}

describe('PaymentProviderRegistry', () => {
  function buildDiscoveryService(instances: unknown[]): DiscoveryService {
    return {
      getProviders: jest.fn().mockReturnValue(instances.map((instance) => ({ instance }))),
    } as unknown as DiscoveryService;
  }

  function buildReflector(): Reflector {
    return {
      get: jest.fn((key: symbol, target: object) => Reflect.getMetadata(key, target)),
    } as unknown as Reflector;
  }

  it('descubre providers decorados con @RegisterPaymentProvider en onModuleInit', () => {
    const fakeProvider = new FakeWebpayProvider();
    const discovery = buildDiscoveryService([fakeProvider, new NotAProvider(), null]);
    const reflector = buildReflector();
    const registry = new PaymentProviderRegistry(discovery, reflector);

    registry.onModuleInit();

    expect(registry.resolve(PaymentProviderId.TransbankWebpayPlus)).toBe(fakeProvider);
  });

  it('resolve lanza UnknownPaymentProviderException si el id no está registrado', () => {
    const discovery = buildDiscoveryService([]);
    const registry = new PaymentProviderRegistry(discovery, buildReflector());

    registry.onModuleInit();

    expect(() => registry.resolve(PaymentProviderId.MercadoPagoCheckoutPro)).toThrow(
      UnknownPaymentProviderException,
    );
  });

  it('listDescriptors expone el describe() de cada provider registrado', () => {
    const discovery = buildDiscoveryService([new FakeWebpayProvider()]);
    const registry = new PaymentProviderRegistry(discovery, buildReflector());

    registry.onModuleInit();

    expect(registry.listDescriptors()).toEqual([
      {
        id: PaymentProviderId.TransbankWebpayPlus,
        labelKey: 'paymentMethods.webpay',
        requiresInscribedCard: false,
        supportsRefund: true,
      },
    ]);
  });

  it('ignora providers sin la metadata del decorador', () => {
    const discovery = buildDiscoveryService([new NotAProvider()]);
    const registry = new PaymentProviderRegistry(discovery, buildReflector());

    registry.onModuleInit();

    expect(registry.listDescriptors()).toEqual([]);
  });
});
