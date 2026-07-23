import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PaymentMethodResponse } from './dto/payment-method.response';
import { PaymentProviderRegistry } from './registry/payment-provider.registry';

/** Descriptores de los métodos de pago disponibles, para que la web arme el selector de checkout. */
@ApiTags('payment-methods')
@Controller({ path: 'payment-methods', version: '1' })
export class PaymentMethodsController {
  constructor(private readonly registry: PaymentProviderRegistry) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los métodos de pago registrados',
    description:
      'Descubiertos automáticamente en el arranque vía `PaymentProviderRegistry` (todo provider ' +
      'decorado con `@RegisterPaymentProvider`). No requiere agregar nada a mano al sumar un PSP nuevo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métodos de pago disponibles.',
    type: [PaymentMethodResponse],
  })
  list(): PaymentMethodResponse[] {
    return this.registry.listDescriptors().map(PaymentMethodResponse.from);
  }
}
