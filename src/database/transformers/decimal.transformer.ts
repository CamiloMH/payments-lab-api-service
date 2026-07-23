import type { ValueTransformer } from 'typeorm';

/**
 * TypeORM/mysql2 representan `decimal` como string para no perder precisión.
 * Como la única moneda soportada es CLP (sin decimales), este transformer
 * expone montos como `number` en TypeScript truncando cualquier fracción.
 */
export const decimalTransformer: ValueTransformer = {
  to(value: number | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    return String(Math.trunc(value));
  },
  from(value: string | null): number | null {
    if (value === null) return null;
    return Math.trunc(Number(value));
  },
};
