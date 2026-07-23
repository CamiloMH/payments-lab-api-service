import { ApiProperty } from '@nestjs/swagger';
import { PaymentProviderId, type PaymentMethodDescriptor } from '@/domain';
import { Expose, plainToInstance } from 'class-transformer';

/** Metadata de un método de pago para que el front arme el selector de checkout. */
export class PaymentMethodResponse {
  @Expose()
  @ApiProperty({ enum: PaymentProviderId, description: 'Identificador del proveedor de pago.' })
  id!: PaymentProviderId;

  @Expose()
  @ApiProperty({ description: 'Clave i18n del nombre visible (ej. "paymentMethods.webpay").' })
  labelKey!: string;

  @Expose()
  @ApiProperty({
    description:
      'true si el checkout con este método exige elegir una tarjeta inscrita (ej. Oneclick).',
  })
  requiresInscribedCard!: boolean;

  static from(descriptor: PaymentMethodDescriptor): PaymentMethodResponse {
    return plainToInstance(PaymentMethodResponse, descriptor, { excludeExtraneousValues: true });
  }
}
