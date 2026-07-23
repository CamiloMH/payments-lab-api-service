import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentAttemptStatus,
  PaymentProviderId,
  PaymentTraceSource,
  PaymentTraceType,
} from '@/domain';
import { Expose, plainToInstance } from 'class-transformer';
import type { PaymentTrace } from '../entities/payment-trace.entity';

/**
 * Forma pública de una traza de trazabilidad de pago. Expone solo campos
 * seguros y estructurados: **nunca** incluye `rawPayload` (la respuesta cruda
 * del PSP se conserva únicamente en el servidor para diagnóstico).
 */
export class PaymentTraceResponse {
  @Expose()
  @ApiProperty({ description: 'Identificador único de la traza.' })
  id!: string;

  @Expose()
  @ApiProperty({ enum: PaymentProviderId, description: 'Proveedor de pago involucrado.' })
  provider!: PaymentProviderId;

  @Expose()
  @ApiProperty({ enum: PaymentTraceType, description: 'Qué representó la interacción con el PSP.' })
  type!: PaymentTraceType;

  @Expose()
  @ApiProperty({
    enum: PaymentTraceSource,
    description: 'Canal que originó la traza (callback, webhook…).',
  })
  source!: PaymentTraceSource;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Resultado del pago si la interacción lo resolvió, o `null`.',
  })
  approved!: boolean | null;

  @Expose()
  @ApiProperty({
    enum: PaymentAttemptStatus,
    nullable: true,
    description: 'Estado del intento resultante de la interacción, si aplica.',
  })
  attemptStatus!: PaymentAttemptStatus | null;

  @Expose()
  @ApiProperty({ nullable: true, description: 'Código de respuesta del PSP, si lo informó.' })
  responseCode!: string | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Últimos 4 dígitos de la tarjeta, si el PSP los informó.',
  })
  cardLast4!: string | null;

  @Expose()
  @ApiProperty({ description: 'Fecha en que se registró la traza.' })
  createdAt!: Date;

  static from(trace: PaymentTrace): PaymentTraceResponse {
    return plainToInstance(PaymentTraceResponse, trace, { excludeExtraneousValues: true });
  }
}
