import { PaymentProviderId } from '@/domain';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const checkoutSchema = z.object({
  provider: z
    .enum(PaymentProviderId)
    .describe('Proveedor de pago elegido (ver GET /payment-methods para la lista disponible).'),
  cardId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Id de la tarjeta inscrita a usar. Solo requerido si el proveedor exige `requiresInscribedCard: true` (Oneclick).',
    ),
});

export class CheckoutDto extends createZodDto(checkoutSchema) {}
