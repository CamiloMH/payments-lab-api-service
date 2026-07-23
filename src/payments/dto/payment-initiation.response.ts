import { ApiProperty } from '@nestjs/swagger';
import { RedirectKind, type PaymentInitiation } from '@/domain';
import { Expose, plainToInstance } from 'class-transformer';

/**
 * Forma pública de un `PaymentInitiation`. Oculta `confirmation` (variante
 * `kind: none`): es la respuesta cruda del PSP para un cobro directo ya
 * resuelto; el front solo necesita saber que no hay redirect, no el payload.
 */
export class PaymentInitiationResponse {
  @Expose()
  @ApiProperty({
    enum: RedirectKind,
    description:
      '`form_post`: enviar un form oculto a `url` con `fields`. `url`: redirigir a `url`. ' +
      '`none`: cobro directo ya resuelto, sin redirect.',
  })
  kind!: RedirectKind;

  @Expose()
  @ApiProperty({ required: false, description: 'URL del PSP. Presente en `form_post` y `url`.' })
  url?: string;

  @Expose()
  @ApiProperty({
    required: false,
    additionalProperties: { type: 'string' },
    description: 'Campos ocultos del form (ej. token_ws). Presente solo en `form_post`.',
  })
  fields?: Record<string, string>;

  static from(initiation: PaymentInitiation): PaymentInitiationResponse {
    return plainToInstance(PaymentInitiationResponse, initiation, {
      excludeExtraneousValues: true,
    });
  }
}
