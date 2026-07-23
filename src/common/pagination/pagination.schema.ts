import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Tamaño de página por defecto cuando el cliente no envía `pageSize`. */
export const DEFAULT_PAGE_SIZE = 12;

/** Techo del `pageSize` para acotar el costo de una sola consulta. */
export const MAX_PAGE_SIZE = 100;

/**
 * Parámetros de paginación comunes (`?page=&pageSize=`). Los query params llegan
 * como string, así que `z.coerce.number` los convierte antes de validar. `page`
 * es 1-indexada; ambos tienen default para que el endpoint funcione sin query.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Página solicitada, 1-indexada.'),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe('Cantidad de elementos por página.'),
});

export class PaginationQueryDto extends createZodDto(paginationSchema) {}
