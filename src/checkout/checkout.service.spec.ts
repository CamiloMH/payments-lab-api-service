import { ConfigService } from '@nestjs/config';
import type { DiscoveryService, Reflector } from '@nestjs/core';
import type { DataSource, EntityManager } from 'typeorm';
import {
  OrderEventType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProviderId,
  RedirectKind,
} from '@/domain';

import { Cart, CartStatus } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import type { CartService } from '../cart/cart.service';
import { CartEmptyException } from '../cart/exceptions/cart.exceptions';
import { Product } from '../products/entities/product.entity';
import { ProductNotFoundException } from '../products/exceptions/product.exceptions';
import type { ProductRepository } from '../products/repositories/product.repository';
import { CallbackPivot } from '../callback-pivots/entities/callback-pivot.entity';
import type { CallbackPivotService } from '../callback-pivots/callback-pivot.service';
import type { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { CardNotFoundException } from '../cards/exceptions/card.exceptions';
import { InscribedCard } from '../cards/entities/inscribed-card.entity';
import type { InscribedCardRepository } from '../cards/repositories/inscribed-card.repository';
import type { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import type {
  InitiatePaymentContext,
  PaymentProviderPort,
} from '../payments/ports/payment-provider.port';
import { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';
import { RegisterPaymentProvider } from '../payments/registry/register-provider.decorator';
import { DemoSession } from '../session/entities/demo-session.entity';
import { StockReservationService } from '../stock/stock-reservation.service';
import { Order } from '../orders/entities/order.entity';
import {
  InvalidOrderTransitionException,
  OrderNotFoundException,
  OrderNotOwnedException,
} from '../orders/exceptions/order.exceptions';
/** Doble de `DomainEventPublisher`: registra las publicaciones para las aserciones. */
function mockEvents() {
  return {
    transition: jest.fn().mockResolvedValue([]),
    settled: jest.fn(),
    traced: jest.fn().mockResolvedValue([]),
    tracedFromConfirmation: jest.fn().mockResolvedValue([]),
    cardEnrolled: jest.fn(),
    stockChanged: jest.fn(),
  };
}
import type { OrderItemRepository } from '../orders/repositories/order-item.repository';
import type { OrderRepository } from '../orders/repositories/order.repository';
import { CheckoutService } from './checkout.service';

@RegisterPaymentProvider(PaymentProviderId.MercadoPagoCheckoutPro)
class FakeUrlProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.MercadoPagoCheckoutPro;
  lastContext?: InitiatePaymentContext;
  describe() {
    return {
      id: this.id,
      labelKey: 'paymentMethods.fake',
      requiresInscribedCard: false,
      supportsRefund: false,
    };
  }
  async initiatePayment(ctx: InitiatePaymentContext) {
    this.lastContext = ctx;
    return { kind: RedirectKind.Url as const, url: `https://fake-psp.test/pay/${ctx.attempt.id}` };
  }
  async confirmFromCallback(): Promise<never> {
    throw new Error('no usado en este test');
  }
  async verifyPayment(): Promise<never> {
    throw new Error('no usado en este test');
  }
  async refund() {
    return { succeeded: false, raw: {} };
  }
}

@RegisterPaymentProvider(PaymentProviderId.TransbankOneclick)
class FakeDirectChargeProvider implements PaymentProviderPort {
  readonly id = PaymentProviderId.TransbankOneclick;
  constructor(private readonly approved: boolean = true) {}
  describe() {
    return {
      id: this.id,
      labelKey: 'paymentMethods.fake-direct',
      requiresInscribedCard: true,
      supportsRefund: true,
    };
  }
  async initiatePayment() {
    return {
      kind: RedirectKind.None as const,
      confirmation: {
        approved: this.approved,
        attemptStatus: this.approved
          ? PaymentAttemptStatus.Confirmed
          : PaymentAttemptStatus.Rejected,
        externalPaymentId: 'ext-1',
        responseCode: this.approved ? '0' : '-1',
        cardLast4: '1234',
        raw: {},
      },
    };
  }
  async confirmFromCallback(): Promise<never> {
    throw new Error('no usado en este test');
  }
  async verifyPayment(): Promise<never> {
    throw new Error('no usado en este test');
  }
  async refund() {
    return { succeeded: false, raw: {} };
  }
}

function buildRegistryWithFakeProvider(
  provider: PaymentProviderPort = new FakeUrlProvider(),
): PaymentProviderRegistry {
  const discovery = {
    getProviders: jest.fn().mockReturnValue([{ instance: provider }]),
  } as unknown as DiscoveryService;
  const reflector = {
    get: jest.fn((key: symbol, target: object) => Reflect.getMetadata(key, target)),
  } as unknown as Reflector;
  const registry = new PaymentProviderRegistry(discovery, reflector);
  registry.onModuleInit();
  return registry;
}

function mockRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findById: jest.fn(),
    findByIds: jest.fn().mockResolvedValue([]),
    findByIdAndSession: jest.fn(),
    create: jest.fn((partial: unknown) => partial),
    save: jest.fn(async (entity: unknown) => entity),
    saveMany: jest.fn(async (entities: unknown) => entities),
    ...overrides,
  };
}

describe('CheckoutService', () => {
  function buildSession(): DemoSession {
    return { id: 'session-1', createdAt: new Date(), lastSeenAt: new Date() } as DemoSession;
  }

  function buildProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'p1',
      name: 'Mouse',
      description: 'x',
      priceClp: 9990,
      stockTotal: 10,
      stockReserved: 0,
      imageUrl: null,
      isSeed: true,
      createdBySessionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    } as Product;
  }

  function buildCart(items: Partial<CartItem>[]): Cart {
    return {
      id: 'cart-1',
      sessionId: 'session-1',
      status: CartStatus.Active,
      items: items as CartItem[],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Cart;
  }

  function buildOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 'order-1',
      buyOrder: 'PL-order-1',
      sessionId: 'session-1',
      status: OrderStatus.PaymentFailed,
      totalClp: 19980,
      expiresAt: new Date(Date.now() + 600_000),
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as unknown as Order;
  }

  function buildDeps(
    overrides: {
      cart?: Cart;
      products?: Product[];
      reserveAtomicWith?: jest.Mock;
      orderFindOne?: jest.Mock;
      inscribedCardFindOne?: jest.Mock;
      provider?: PaymentProviderPort;
      publicApiUrlMissing?: boolean;
    } = {},
  ) {
    const cart = overrides.cart ?? buildCart([{ productId: 'p1', quantity: 2 }]);
    const products = overrides.products ?? [buildProduct()];

    const cartService = {
      getActiveCart: jest.fn().mockResolvedValue(cart),
      markCheckedOut: jest.fn(),
    } as unknown as CartService;

    const productsRepo = mockRepo({
      findByIds: jest.fn().mockResolvedValue(products),
    }) as unknown as ProductRepository;
    const ordersRepo = mockRepo(
      overrides.orderFindOne ? { findById: overrides.orderFindOne } : {},
    ) as unknown as OrderRepository;
    const orderItemsRepo = mockRepo() as unknown as OrderItemRepository;
    const paymentAttemptsRepo = mockRepo() as unknown as PaymentAttemptRepository;
    const inscribedCardsRepo = mockRepo(
      overrides.inscribedCardFindOne ? { findByIdAndSession: overrides.inscribedCardFindOne } : {},
    ) as unknown as InscribedCardRepository;

    const stockReservationService = {
      reserveAtomicWith:
        overrides.reserveAtomicWith ??
        jest.fn().mockResolvedValue({ reservations: [], touchedProducts: [] }),
      emitAvailabilityFor: jest.fn(),
      extendExpiry: jest.fn(),
      consume: jest.fn(),
      release: jest.fn(),
    } as unknown as StockReservationService;

    // Ejecuta el callback de la transacción con un manager ficticio; los
    // repositorios están mockeados y no usan el manager real.
    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) => cb({} as EntityManager)),
    } as unknown as DataSource;

    const callbackPivotService = {
      create: jest.fn().mockResolvedValue({ id: 'pivot-1' } as CallbackPivot),
    } as unknown as CallbackPivotService;

    const urlProvider = overrides.provider ?? new FakeUrlProvider();
    const registry = buildRegistryWithFakeProvider(urlProvider);

    const configService = {
      get: jest
        .fn()
        .mockReturnValue(overrides.publicApiUrlMissing ? undefined : 'http://localhost:3001'),
    } as unknown as ConfigService;

    const events = mockEvents();

    const service = new CheckoutService(
      cartService,
      productsRepo,
      ordersRepo,
      orderItemsRepo,
      paymentAttemptsRepo,
      inscribedCardsRepo,
      stockReservationService,
      callbackPivotService,
      registry,
      configService,
      events as unknown as DomainEventPublisher,
      dataSource,
    );

    return {
      service,
      cartService,
      ordersRepo,
      orderItemsRepo,
      paymentAttemptsRepo,
      stockReservationService,
      urlProvider,
      events,
    };
  }

  it('rechaza el checkout si el carrito está vacío', async () => {
    const { service } = buildDeps({ cart: buildCart([]) });

    await expect(
      service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    ).rejects.toThrow(CartEmptyException);
  });

  it('reserva stock, crea la orden y resuelve el provider vía el registry', async () => {
    const { service, ordersRepo, paymentAttemptsRepo, stockReservationService, events } =
      buildDeps();

    const result = await service.checkout(buildSession(), {
      provider: PaymentProviderId.MercadoPagoCheckoutPro,
    });

    expect(stockReservationService.reserveAtomicWith).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      [{ productId: 'p1', quantity: 2 }],
    );
    expect(ordersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        totalClp: 19980,
        status: OrderStatus.PendingPayment,
      }),
      expect.anything(),
    );
    expect(paymentAttemptsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    );
    expect(result.initiation.kind).toBe(RedirectKind.Url);
    expect(result.order.status).toBe(OrderStatus.PendingPayment);
    expect(events.transition).toHaveBeenCalledWith(
      expect.any(String),
      OrderEventType.OrderCreated,
      { toStatus: OrderStatus.PendingPayment },
    );
    expect(events.transition).toHaveBeenCalledWith(
      expect.any(String),
      OrderEventType.PaymentInitiated,
      expect.objectContaining({ provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    );
  });

  it('marca el intento como Redirected y extiende la gracia de la reserva cuando el pago redirige', async () => {
    const { service, paymentAttemptsRepo, stockReservationService, events } = buildDeps();

    await service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro });

    expect(paymentAttemptsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentAttemptStatus.Redirected }),
    );
    expect(stockReservationService.extendExpiry).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
    );
    expect(events.transition).toHaveBeenCalledWith(
      expect.any(String),
      OrderEventType.RedirectedToProvider,
      expect.objectContaining({ provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    );
  });

  it('marca el carrito como CheckedOut tras un checkout exitoso', async () => {
    const { service, cartService } = buildDeps();

    await service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro });

    expect(cartService.markCheckedOut).toHaveBeenCalledWith('cart-1');
  });

  it('revierte la transacción y propaga InsufficientStockException si no hay stock (no marca el carrito ni guarda items)', async () => {
    const insufficientError = new Error('sin stock');
    const { service, orderItemsRepo, cartService } = buildDeps({
      reserveAtomicWith: jest.fn().mockRejectedValue(insufficientError),
    });

    await expect(
      service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    ).rejects.toThrow(insufficientError);
    // La reserva falla dentro de la transacción: el rollback deshace la orden
    // (verificado a nivel de DB) y el flujo se aborta sin efectos posteriores.
    expect(orderItemsRepo.saveMany).not.toHaveBeenCalled();
    expect(cartService.markCheckedOut).not.toHaveBeenCalled();
  });

  it('usa localhost:3001 como PUBLIC_API_URL de respaldo si la variable de entorno no está definida', async () => {
    const { service, urlProvider } = buildDeps({ publicApiUrlMissing: true });

    await service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro });

    expect((urlProvider as FakeUrlProvider).lastContext?.returnUrl).toMatch(
      /^http:\/\/localhost:3001\//,
    );
  });

  it('lanza ProductNotFoundException si algún producto del carrito ya no existe', async () => {
    const { service } = buildDeps({ products: [] });

    await expect(
      service.checkout(buildSession(), { provider: PaymentProviderId.MercadoPagoCheckoutPro }),
    ).rejects.toThrow(ProductNotFoundException);
  });

  it('lanza CardNotFoundException si la tarjeta inscrita indicada no existe o no es de la sesión', async () => {
    const { service } = buildDeps({
      provider: new FakeDirectChargeProvider(),
      inscribedCardFindOne: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.checkout(buildSession(), {
        provider: PaymentProviderId.TransbankOneclick,
        cardId: 'card-inexistente',
      }),
    ).rejects.toThrow(CardNotFoundException);
  });

  it('resuelve la tarjeta inscrita de la sesión cuando se indica un cardId válido', async () => {
    const card = { id: 'card-1', sessionId: 'session-1' } as InscribedCard;
    const { service } = buildDeps({
      provider: new FakeDirectChargeProvider(),
      inscribedCardFindOne: jest.fn().mockResolvedValue(card),
    });

    const result = await service.checkout(buildSession(), {
      provider: PaymentProviderId.TransbankOneclick,
      cardId: 'card-1',
    });

    expect(result.initiation.kind).toBe(RedirectKind.None);
  });

  it('en un cobro directo (RedirectKind.None) aprobado, marca Paid y consume la reserva', async () => {
    const { service, ordersRepo, paymentAttemptsRepo, stockReservationService, events } = buildDeps(
      {
        provider: new FakeDirectChargeProvider(true),
      },
    );

    const result = await service.checkout(buildSession(), {
      provider: PaymentProviderId.TransbankOneclick,
    });

    expect(result.initiation.kind).toBe(RedirectKind.None);
    expect(ordersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.Paid }),
    );
    expect(events.settled).toHaveBeenCalledWith(expect.any(String), OrderStatus.Paid);
    expect(paymentAttemptsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentAttemptStatus.Confirmed }),
    );
    expect(stockReservationService.consume).toHaveBeenCalledWith(expect.any(String));
    expect(events.transition).toHaveBeenCalledWith(
      expect.any(String),
      OrderEventType.OrderPaid,
      expect.objectContaining({ toStatus: OrderStatus.Paid }),
    );
  });

  it('en un cobro directo (RedirectKind.None) rechazado, marca PaymentFailed sin consumir la reserva', async () => {
    const { service, ordersRepo, paymentAttemptsRepo, stockReservationService, events } = buildDeps(
      {
        provider: new FakeDirectChargeProvider(false),
      },
    );

    const result = await service.checkout(buildSession(), {
      provider: PaymentProviderId.TransbankOneclick,
    });

    expect(result.initiation.kind).toBe(RedirectKind.None);
    expect(ordersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.PaymentFailed }),
    );
    expect(paymentAttemptsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentAttemptStatus.Rejected }),
    );
    expect(stockReservationService.consume).not.toHaveBeenCalled();
    expect(events.transition).toHaveBeenCalledWith(
      expect.any(String),
      OrderEventType.PaymentFailed,
      expect.objectContaining({ toStatus: OrderStatus.PaymentFailed }),
    );
  });

  describe('retry', () => {
    it('reintenta el pago de una orden PaymentFailed sin volver a reservar stock', async () => {
      const order = buildOrder({ status: OrderStatus.PaymentFailed });
      const { service, ordersRepo, paymentAttemptsRepo, stockReservationService, events } =
        buildDeps({
          orderFindOne: jest.fn().mockResolvedValue(order),
        });

      const result = await service.retry(buildSession(), 'order-1', {
        provider: PaymentProviderId.MercadoPagoCheckoutPro,
      });

      expect(stockReservationService.reserveAtomicWith).not.toHaveBeenCalled();
      expect(ordersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.PendingPayment }),
      );
      expect(paymentAttemptsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ provider: PaymentProviderId.MercadoPagoCheckoutPro }),
      );
      expect(result.initiation.kind).toBe(RedirectKind.Url);
      expect(events.transition).toHaveBeenCalledWith('order-1', OrderEventType.RetryStarted, {
        fromStatus: OrderStatus.PaymentFailed,
        toStatus: OrderStatus.PendingPayment,
      });
    });

    it('lanza OrderNotFoundException si la orden no existe', async () => {
      const { service } = buildDeps({ orderFindOne: jest.fn().mockResolvedValue(null) });

      await expect(
        service.retry(buildSession(), 'missing', {
          provider: PaymentProviderId.MercadoPagoCheckoutPro,
        }),
      ).rejects.toThrow(OrderNotFoundException);
    });

    it('rechaza reintentar una orden de otra sesión', async () => {
      const order = buildOrder({ sessionId: 'otra-sesion' });
      const { service } = buildDeps({ orderFindOne: jest.fn().mockResolvedValue(order) });

      await expect(
        service.retry(buildSession(), 'order-1', {
          provider: PaymentProviderId.MercadoPagoCheckoutPro,
        }),
      ).rejects.toThrow(OrderNotOwnedException);
    });

    it('rechaza reintentar una orden que no está en PaymentFailed', async () => {
      const order = buildOrder({ status: OrderStatus.Paid });
      const { service } = buildDeps({ orderFindOne: jest.fn().mockResolvedValue(order) });

      await expect(
        service.retry(buildSession(), 'order-1', {
          provider: PaymentProviderId.MercadoPagoCheckoutPro,
        }),
      ).rejects.toThrow(InvalidOrderTransitionException);
    });
  });
});
