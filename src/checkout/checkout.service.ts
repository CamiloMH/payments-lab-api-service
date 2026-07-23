import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import {
  IN_FLIGHT_GRACE_MINUTES,
  OrderEventType,
  OrderStatus,
  type PaymentInitiation,
  PaymentAttemptStatus,
  type PaymentProviderId,
  PaymentTracedEvent,
  PaymentTraceSource,
  PaymentTraceType,
  RedirectKind,
} from '@/domain';

import { CartService } from '../cart/cart.service';
import { CartEmptyException } from '../cart/exceptions/cart.exceptions';
import { DEFAULT_PUBLIC_API_URL, WEB_PAYMENT_RETURN_PATH } from '../common/config.defaults';
import { formatLogFields } from '../common/logging/format-log-fields';
import { generateId } from '../common/nanoid';
import { assertOrderTransitionOrConflict } from '../common/assert-order-transition-or-conflict';
import { Order } from '../orders/entities/order.entity';
import {
  OrderNotFoundException,
  OrderNotOwnedException,
} from '../orders/exceptions/order.exceptions';
import { OrderFactory } from '../orders/factories/order.factory';
import { OrderItemRepository } from '../orders/repositories/order-item.repository';
import { OrderRepository } from '../orders/repositories/order.repository';
import { DomainEventPublisher } from '../common/events/domain-event.publisher';
import { CallbackPivotService } from '../callback-pivots/callback-pivot.service';
import { CardNotFoundException } from '../cards/exceptions/card.exceptions';
import { InscribedCard } from '../cards/entities/inscribed-card.entity';
import { PaymentAttempt } from '../payments/entities/payment-attempt.entity';
import { InscribedCardRepository } from '../cards/repositories/inscribed-card.repository';
import { PaymentAttemptRepository } from '../payments/repositories/payment-attempt.repository';
import { PaymentProviderRegistry } from '../payments/registry/payment-provider.registry';
import { Product } from '../products/entities/product.entity';
import { ProductNotFoundException } from '../products/exceptions/product.exceptions';
import { ProductRepository } from '../products/repositories/product.repository';
import { DemoSession } from '../session/entities/demo-session.entity';
import { StockReservationService } from '../stock/stock-reservation.service';

/** Input público de `POST /checkout` y `POST /orders/:id/retry`. */
export interface CheckoutInput {
  provider: PaymentProviderId;
  cardId?: string;
}

export interface CheckoutResult {
  order: Order;
  initiation: PaymentInitiation;
}

/**
 * Orquesta el checkout completo: valida el carrito, reserva stock de forma
 * atómica, crea la orden + snapshot de items, abre el intento de pago y lo
 * delega al proveedor resuelto desde el registry. Es el único punto del
 * dominio que conoce carrito, stock, órdenes y pagos a la vez.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly cartService: CartService,
    private readonly products: ProductRepository,
    private readonly orders: OrderRepository,
    private readonly orderItems: OrderItemRepository,
    private readonly paymentAttempts: PaymentAttemptRepository,
    private readonly inscribedCards: InscribedCardRepository,
    private readonly stockReservationService: StockReservationService,
    private readonly callbackPivotService: CallbackPivotService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly configService: ConfigService,
    private readonly events: DomainEventPublisher,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Valida que el carrito activo de la sesión no esté vacío, reserva stock
   * atómicamente para todos sus ítems (falla completo si alguno no alcanza),
   * crea la orden con el snapshot de items y abre el intento de pago.
   */
  async checkout(session: DemoSession, input: CheckoutInput): Promise<CheckoutResult> {
    this.logger.log(
      formatLogFields({ sessionId: session.id, provider: input.provider, cardId: input.cardId }),
    );
    const cart = await this.cartService.getActiveCart(session.id);
    if (cart.items.length === 0) {
      throw new CartEmptyException();
    }

    const productById = await this.loadProducts(cart.items.map((item) => item.productId));

    const orderId = generateId();
    const reservationItems = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    const { order, items } = OrderFactory.createPendingOrder({
      orderId,
      session,
      cart,
      productById,
    });

    // La orden se persiste ANTES que las reservas y en la MISMA transacción: la
    // FK `stock_reservations → orders` exige que la orden exista, y si no hay
    // stock (InsufficientStockException) el rollback deshace la orden para que
    // no quede huérfana. La emisión de disponibilidad va tras el commit.
    const { savedOrder, touchedProducts } = await this.dataSource.transaction(async (manager) => {
      const persistedOrder = await this.orders.save(order, manager);
      const { touchedProducts } = await this.stockReservationService.reserveAtomicWith(
        manager,
        orderId,
        reservationItems,
      );
      return { savedOrder: persistedOrder, touchedProducts };
    });
    this.stockReservationService.emitAvailabilityFor(touchedProducts);

    // Guardar los items y marcar el carrito usado no dependen entre sí.
    await Promise.all([this.orderItems.saveMany(items), this.cartService.markCheckedOut(cart.id)]);
    await this.events.transition(savedOrder.id, OrderEventType.OrderCreated, {
      toStatus: OrderStatus.PendingPayment,
    });

    return this.initiatePaymentForOrder(session, savedOrder, input);
  }

  /**
   * Reintenta el pago de una orden `PaymentFailed` propia: las reservas de
   * stock originales siguen activas (no se vuelve a reservar), solo se abre
   * un nuevo intento de pago.
   */
  async retry(
    session: DemoSession,
    orderId: string,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    this.logger.log(formatLogFields({ orderId, provider: input.provider }));
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new OrderNotFoundException(orderId);
    }
    if (order.sessionId !== session.id) {
      throw new OrderNotOwnedException();
    }
    const fromStatus = order.status;
    assertOrderTransitionOrConflict(order.status, OrderStatus.PendingPayment);

    order.status = OrderStatus.PendingPayment;
    const savedOrder = await this.orders.save(order);
    await this.events.transition(savedOrder.id, OrderEventType.RetryStarted, {
      fromStatus,
      toStatus: OrderStatus.PendingPayment,
    });

    return this.initiatePaymentForOrder(session, savedOrder, input);
  }

  /** Crea el intento de pago + pivot y lo delega al proveedor. Compartido por `checkout` y `retry`. */
  private async initiatePaymentForOrder(
    session: DemoSession,
    order: Order,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    const attempt = OrderFactory.createInitialAttempt(order.id, input.provider);
    const savedAttempt = await this.paymentAttempts.save(attempt);
    await this.events.transition(order.id, OrderEventType.PaymentInitiated, {
      provider: input.provider,
      attemptId: savedAttempt.id,
    });

    // Crear el pivot y resolver la tarjeta inscrita no dependen entre sí.
    const [pivot, inscribedCard] = await Promise.all([
      this.callbackPivotService.create({
        paymentAttemptId: savedAttempt.id,
        // Ruta localizada de resultado; el controller le concatena `&status=`.
        redirectPath: `${WEB_PAYMENT_RETURN_PATH}?orderId=${order.id}`,
      }),
      this.resolveInscribedCard(input.cardId, session.id),
    ]);

    const publicApiUrl = this.configService.get<string>('PUBLIC_API_URL') ?? DEFAULT_PUBLIC_API_URL;
    const returnUrl = `${publicApiUrl}/api/v1/payments/callback/${input.provider}?pivot=${pivot.id}`;
    const provider = this.paymentProviderRegistry.resolve(input.provider);

    const initiation = await provider.initiatePayment({
      order,
      attempt: savedAttempt,
      pivotUuid: pivot.id,
      returnUrl,
      session,
      inscribedCard,
    });

    await this.applyInitiationResult(order, savedAttempt, initiation);

    this.logger.log(
      formatLogFields({ orderId: order.id, provider: input.provider, kind: initiation.kind }),
    );

    return { order, initiation };
  }

  /** Carga los productos del carrito indexados por id. @throws {ProductNotFoundException} si alguno ya no existe. */
  private async loadProducts(productIds: string[]): Promise<Map<string, Product>> {
    const products = await this.products.findByIds(productIds);
    const byId = new Map(products.map((product) => [product.id, product]));
    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new ProductNotFoundException(missing);
    }
    return byId;
  }

  /** Resuelve la tarjeta inscrita si se indicó `cardId`. @throws {CardNotFoundException} si no existe o no es de la sesión. */
  private async resolveInscribedCard(
    cardId: string | undefined,
    sessionId: string,
  ): Promise<InscribedCard | undefined> {
    if (!cardId) return undefined;
    const card = await this.inscribedCards.findByIdAndSession(cardId, sessionId);
    if (!card) {
      throw new CardNotFoundException(cardId);
    }
    return card;
  }

  /**
   * Aplica el resultado de `initiatePayment`: si fue un cobro directo
   * (`RedirectKind.None`), resuelve la orden de inmediato; si el usuario debe
   * ser redirigido al PSP, marca el intento `Redirected` y da gracia a la
   * reserva para que el sweep no libere el stock mientras paga.
   */
  private async applyInitiationResult(
    order: Order,
    attempt: PaymentAttempt,
    initiation: PaymentInitiation,
  ): Promise<void> {
    const fromStatus = order.status;

    if (initiation.kind === RedirectKind.None) {
      const { confirmation } = initiation;
      attempt.status = confirmation.attemptStatus;
      attempt.externalPaymentId = confirmation.externalPaymentId;
      attempt.responseCode = confirmation.responseCode;
      attempt.cardLast4 = confirmation.cardLast4;
      attempt.rawResponse = confirmation.raw;
      await this.paymentAttempts.save(attempt);

      // Cobro directo (Oneclick): la traza del pago se registra al iniciarlo.
      await this.events.tracedFromConfirmation(
        { orderId: attempt.orderId, attemptId: attempt.id, provider: attempt.provider },
        confirmation,
        PaymentTraceSource.Initiation,
      );

      order.status = confirmation.approved ? OrderStatus.Paid : OrderStatus.PaymentFailed;
      await this.orders.save(order);
      this.events.settled(order.id, order.status);
      if (confirmation.approved) {
        await this.stockReservationService.consume(order.id);
        this.logger.log(formatLogFields({ orderId: order.id, status: order.status }));
      } else {
        this.logger.warn(formatLogFields({ orderId: order.id, status: order.status }));
      }
      await this.events.transition(
        order.id,
        confirmation.approved ? OrderEventType.OrderPaid : OrderEventType.PaymentFailed,
        { fromStatus, toStatus: order.status, provider: attempt.provider, attemptId: attempt.id },
      );
      return;
    }

    attempt.status = PaymentAttemptStatus.Redirected;
    await this.paymentAttempts.save(attempt);
    await this.stockReservationService.extendExpiry(order.id, IN_FLIGHT_GRACE_MINUTES);
    await this.events.transition(order.id, OrderEventType.RedirectedToProvider, {
      provider: attempt.provider,
      attemptId: attempt.id,
    });
    await this.events.traced(
      new PaymentTracedEvent(
        order.id,
        attempt.provider,
        PaymentTraceType.Redirected,
        PaymentTraceSource.Initiation,
        attempt.id,
      ),
    );
    this.logger.log(formatLogFields({ orderId: order.id, provider: attempt.provider }));
  }
}
