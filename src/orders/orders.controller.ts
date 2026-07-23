import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { mapPage } from '../common/pagination/page';
import { PaginationQueryDto } from '../common/pagination/pagination.schema';
import { SENSITIVE_THROTTLE } from '../common/throttling/throttle.const';
import { CheckoutService } from '../checkout/checkout.service';
import { CheckoutResultResponse } from '../checkout/dto/checkout-result.response';
import { CheckoutDto } from '../checkout/dto/checkout.schema';
import { DemoSession } from '../session/entities/demo-session.entity';
import { CurrentSession } from '../session/session.decorator';
import { OrderEventResponse } from '../order-events/dto/order-event.response';
import { OrderResponse } from './dto/order.response';
import { PaginatedOrderResponse } from './dto/paginated-order.response';
import { PaymentTraceResponse } from '../payment-traces/dto/payment-trace.response';
import { OrdersService } from './orders.service';

/** Consulta, cancelación y reintento de pago de órdenes. */
@ApiTags('orders')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Órdenes de la sesión actual (paginado)',
    description: 'Devuelve una página de las órdenes de la sesión, más recientes primero.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página solicitada (1-indexada). Default 1.',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Elementos por página. Default 12, máximo 100.',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de órdenes de la sesión.',
    type: PaginatedOrderResponse,
  })
  async findMine(
    @CurrentSession() session: DemoSession,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedOrderResponse> {
    const page = await this.ordersService.findBySessionPage(session.id, query.page, query.pageSize);
    // Una sola query resuelve el método de pago de las órdenes de la página (sin N+1).
    const traces = await this.ordersService.latestPaymentTraces(
      page.items.map((order) => order.id),
    );
    return mapPage(page, (order) => OrderResponse.from(order, traces.get(order.id) ?? null));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una orden propia',
    description: 'Solo devuelve la orden si pertenece a la sesión actual.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden.' })
  @ApiResponse({ status: 200, description: 'Orden encontrada.', type: OrderResponse })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  async findOne(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    const order = await this.ordersService.findOwned(id, session.id);
    const traces = await this.ordersService.latestPaymentTraces([id]);
    return OrderResponse.from(order, traces.get(id) ?? null);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancela una orden propia',
    description:
      'Solo permitido sobre órdenes `pending_payment` o `payment_failed` propias de la sesión. ' +
      'Libera inmediatamente el stock reservado.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden a cancelar.' })
  @ApiResponse({ status: 201, description: 'Orden cancelada.', type: OrderResponse })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  @ApiResponse({
    status: 409,
    description: 'La orden no está en un estado desde el que se pueda cancelar.',
  })
  async cancel(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    return OrderResponse.from(await this.ordersService.cancel(id, session.id));
  }

  @Post(':id/retry')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Reintenta el pago de una orden',
    description:
      'Abre un nuevo intento de pago sobre una orden propia en `payment_failed`, sin volver a ' +
      'reservar stock: la reserva original de la orden sigue vigente.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden a reintentar.' })
  @ApiResponse({
    status: 201,
    description: 'Nuevo intento de pago iniciado.',
    type: CheckoutResultResponse,
  })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  @ApiResponse({ status: 409, description: 'La orden no está en payment_failed.' })
  async retry(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResultResponse> {
    return CheckoutResultResponse.from(await this.checkoutService.retry(session, id, dto));
  }

  @Post(':id/refund')
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Devuelve (refund) una orden propia pagada',
    description:
      'Solo permitido sobre órdenes `paid` propias de la sesión. Ejecuta el refund real contra el ' +
      'proveedor que cobró la orden y, si es aceptado, transiciona a `refunded` y restaura el stock ' +
      'consumido. `refunded` es terminal: un segundo intento sobre la misma orden es rechazado.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden a devolver.' })
  @ApiResponse({ status: 201, description: 'Orden devuelta.', type: OrderResponse })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  @ApiResponse({
    status: 409,
    description: 'La orden no está en un estado desde el que se pueda devolver.',
  })
  @ApiResponse({
    status: 502,
    description: 'El proveedor de pago rechazó la solicitud de devolución.',
  })
  async refund(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
  ): Promise<OrderResponse> {
    return OrderResponse.from(await this.ordersService.refund(id, session.id));
  }

  @Get(':id/timeline')
  @ApiOperation({
    summary: 'Historial (audit log) de una orden propia',
    description:
      'Devuelve cada transición relevante del ciclo de vida de la orden (creación, intentos de pago, ' +
      'confirmaciones, cancelación, expiración, devolución…), del evento más antiguo al más reciente.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden.' })
  @ApiResponse({ status: 200, description: 'Timeline de la orden.', type: [OrderEventResponse] })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  async timeline(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
  ): Promise<OrderEventResponse[]> {
    const events = await this.ordersService.timeline(id, session.id);
    return events.map(OrderEventResponse.from);
  }

  @Get(':id/traces')
  @ApiOperation({
    summary: 'Bitácora de trazabilidad de pagos de una orden propia',
    description:
      'Devuelve cada interacción con un PSP registrada para la orden (inicio, redirect, confirmación ' +
      'por callback o webhook, reembolso…), del evento más antiguo al más reciente. Expone solo campos ' +
      'seguros y estructurados: nunca incluye la respuesta cruda del PSP.',
  })
  @ApiParam({ name: 'id', description: 'Id de la orden.' })
  @ApiResponse({
    status: 200,
    description: 'Bitácora de pagos de la orden.',
    type: [PaymentTraceResponse],
  })
  @ApiResponse({ status: 403, description: 'La orden no pertenece a la sesión actual.' })
  @ApiResponse({ status: 404, description: 'No existe una orden con ese id.' })
  async paymentTraces(
    @CurrentSession() session: DemoSession,
    @Param('id') id: string,
  ): Promise<PaymentTraceResponse[]> {
    const traces = await this.ordersService.paymentTraceLog(id, session.id);
    return traces.map(PaymentTraceResponse.from);
  }
}
