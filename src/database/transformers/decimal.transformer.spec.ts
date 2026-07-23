import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  describe('to (JS -> DB)', () => {
    it('convierte un number a string para la columna decimal', () => {
      expect(decimalTransformer.to(1990)).toBe('1990');
    });

    it('trunca a un entero (CLP no usa decimales)', () => {
      expect(decimalTransformer.to(1990.9)).toBe('1990');
    });

    it('propaga null/undefined sin transformar', () => {
      expect(decimalTransformer.to(null as unknown as number)).toBeNull();
      expect(decimalTransformer.to(undefined as unknown as number)).toBeUndefined();
    });
  });

  describe('from (DB -> JS)', () => {
    it('convierte el string que devuelve mysql2 a number', () => {
      expect(decimalTransformer.from('1990')).toBe(1990);
      expect(decimalTransformer.from('1990.00')).toBe(1990);
    });

    it('propaga null sin transformar', () => {
      expect(decimalTransformer.from(null as unknown as string)).toBeNull();
    });
  });
});
