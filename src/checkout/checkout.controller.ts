import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { SENSITIVE_THROTTLE } from '../common/throttling/throttle.const';
import { DemoSession } from '../session/entities/demo-session.entity';
import { CurrentSession } from '../session/session.decorator';
import { CheckoutService } from './checkout.service';
import { CheckoutResultResponse } from './dto/checkout-result.response';
import { CheckoutDto } from './dto/checkout.schema';

/**
 * Orquesta el checkout completo del carrito activo de la sesión: reserva
 * stock de forma atómica, crea la orden con el snapshot de items, abre el
 * intento de pago contra el proveedor elegido y devuelve cómo continuar.
 */
@ApiTags('checkout')
@Controller({ path: 'checkout', version: '1' })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @Throttle(SENSITIVE_THROTTLE)
  @ApiOperation({
    summary: 'Inicia el checkout del carrito activo',
    description:
      'Valida que el carrito no esté vacío, reserva stock atómicamente para todos sus ítems ' +
      '(falla completo si alguno no alcanza), crea la orden y delega en el proveedor de pago ' +
      'elegido. La reserva de stock ya quedó comprometida aunque el pago todavía no se resuelva.',
  })
  @ApiResponse({
    status: 201,
    description: 'Orden creada y pago iniciado.',
    type: CheckoutResultResponse,
  })
  @ApiResponse({ status: 400, description: 'El carrito de la sesión está vacío.' })
  @ApiResponse({
    status: 404,
    description:
      'Algún producto del carrito ya no existe, o la tarjeta inscrita indicada no existe.',
  })
  @ApiResponse({
    status: 409,
    description: 'No hay stock suficiente para completar la reserva (InsufficientStockException).',
  })
  async checkout(
    @CurrentSession() session: DemoSession,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResultResponse> {
    return CheckoutResultResponse.from(await this.checkoutService.checkout(session, dto));
  }
}
