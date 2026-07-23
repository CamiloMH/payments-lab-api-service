import { ORDER_NUMBER_LENGTH, generateId, generateOrderNumber } from './nanoid';

describe('generateId', () => {
  it('genera un id de 21 caracteres', () => {
    expect(generateId()).toHaveLength(21);
  });

  it('genera ids distintos en llamadas sucesivas', () => {
    expect(generateId()).not.toBe(generateId());
  });

  it('usa solo el alfabeto URL-safe de nanoid (sin caracteres especiales)', () => {
    expect(generateId()).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });
});

describe('generateOrderNumber', () => {
  it(`genera un número de ${ORDER_NUMBER_LENGTH} dígitos`, () => {
    expect(generateOrderNumber()).toMatch(new RegExp(`^\\d{${ORDER_NUMBER_LENGTH}}$`));
  });

  it('genera números distintos en llamadas sucesivas (no correlativo)', () => {
    expect(generateOrderNumber()).not.toBe(generateOrderNumber());
  });
});
