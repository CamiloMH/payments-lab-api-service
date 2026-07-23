/** Valor loguéable: primitivos simples, `null` se imprime como "-", `undefined` se omite. */
export type LogFieldValue = string | number | boolean | null | undefined;

/**
 * Formatea pares clave-valor para logs de trazabilidad en español:
 * `campo: valor, campo2: valor2`. Usado por todos los servicios que narran
 * una operación de negocio (`this.logger.log(formatLogFields({...}))`),
 * para que el formato sea consistente en todo el backend sin repetir el
 * `.join(', ')` en cada archivo.
 */
export function formatLogFields(fields: Record<string, LogFieldValue>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value === null ? '-' : value}`)
    .join(', ');
}
