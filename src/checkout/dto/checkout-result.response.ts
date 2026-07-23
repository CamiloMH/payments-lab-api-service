import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type, plainToInstance } from 'class-transformer';
import { OrderResponse } from '../../orders/dto/order.response';
import { PaymentInitiationResponse } from '../../payments/dto/payment-initiation.response';
import type { CheckoutResult } from '../checkout.service';

/** Resultado público de un checkout o un retry: la orden y cómo continuar el pago. */
export class CheckoutResultResponse {
  @Expose()
  @Type(() => OrderResponse)
  @ApiProperty({ type: OrderResponse })
  order!: OrderResponse;

  @Expose()
  @Type(() => PaymentInitiationResponse)
  @ApiProperty({ type: PaymentInitiationResponse })
  initiation!: PaymentInitiationResponse;

  static from(result: CheckoutResult): CheckoutResultResponse {
    return plainToInstance(CheckoutResultResponse, result, { excludeExtraneousValues: true });
  }
}
