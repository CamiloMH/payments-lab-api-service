import { customAlphabet, nanoid } from 'nanoid';

/**
 * Genera el id usado como PK (`varchar(21)`) de casi todas las entidades. Un
 * largo fijo de 21 es lo que asumen los prefijos de `buyOrder` de Transbank
 * (`PL-`/`PLC-` + 21 ≤ 26 chars, el máximo que acepta el SDK); no cambiarlo.
 */
export function generateId(): string {
  return nanoid();
}

/** Longitud del número de orden legible que se muestra al usuario. */
export const ORDER_NUMBER_LENGTH = 12;

const generateOrderNumberDigits = customAlphabet('0123456789', ORDER_NUMBER_LENGTH);

/**
 * Genera el número de orden legible que ve el usuario. Es puramente numérico y
 * aleatorio (no correlativo) a propósito: un número consecutivo dejaría enumerar
 * órdenes ajenas y estimar el volumen del negocio. No es la clave de acceso a la
 * orden (esa es el `id` nanoid), solo un identificador amable para mostrar y dictar.
 */
export function generateOrderNumber(): string {
  return generateOrderNumberDigits();
}
