import { formatLogFields } from './format-log-fields';

describe('formatLogFields', () => {
  it('formatea un único campo como "clave: valor"', () => {
    expect(formatLogFields({ orderId: 'ord_1' })).toBe('orderId: ord_1');
  });

  it('formatea múltiples campos separados por coma, en el orden dado', () => {
    expect(
      formatLogFields({ orderId: 'ord_1', provider: 'transbank_webpay_plus', monto: 15990 }),
    ).toBe('orderId: ord_1, provider: transbank_webpay_plus, monto: 15990');
  });

  it('formatea booleanos como texto', () => {
    expect(formatLogFields({ aprobado: true, reintentado: false })).toBe(
      'aprobado: true, reintentado: false',
    );
  });

  it('imprime "-" para valores null', () => {
    expect(formatLogFields({ cardId: null })).toBe('cardId: -');
  });

  it('omite las claves con valor undefined', () => {
    expect(formatLogFields({ orderId: 'ord_1', cardId: undefined })).toBe('orderId: ord_1');
  });

  it('devuelve string vacío si no hay campos', () => {
    expect(formatLogFields({})).toBe('');
  });
});
