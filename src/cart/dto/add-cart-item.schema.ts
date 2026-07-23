import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addCartItemSchema = z.object({
  productId: z.string().min(1).describe('Id del producto a agregar al carrito.'),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe('Unidades a agregar (se suman si el producto ya estaba).'),
});

export class AddCartItemDto extends createZodDto(addCartItemSchema) {}
