import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const setCartItemQuantitySchema = z.object({
  quantity: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .describe('Cantidad exacta a dejar en el ítem. 0 elimina el ítem del carrito.'),
});

export class SetCartItemQuantityDto extends createZodDto(setCartItemQuantitySchema) {}
