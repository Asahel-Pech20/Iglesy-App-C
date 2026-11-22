import { describe, expect, it } from 'vitest';
import { aCentavos, deCentavos, parsearMonto } from './dinero';

describe('dinero del diezmo (RN-44, RNF-06)', () => {
  it('convierte montos en texto a centavos enteros', () => {
    expect(parsearMonto('1250.50')).toBe(125050);
    expect(parsearMonto('1250.5')).toBe(125050);
    expect(parsearMonto('1250')).toBe(125000);
    expect(parsearMonto('0.05')).toBe(5);
    expect(parsearMonto('0')).toBe(0);
  });

  it('RN-44: 0.10 + 0.20 es exactamente 0.30, sin el error del punto flotante', () => {
    // Con números decimales de JavaScript: 0.1 + 0.2 = 0.30000000000000004
    const suma = aCentavos('0.10') + aCentavos('0.20');
    expect(deCentavos(suma)).toBe('0.30');
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it.each(['', 'abc', '-5', '12.345', '1,250.50', '1e3', ' 10', '10 ', '.50', '12345678901.00'])(
    'rechaza el monto no válido «%s»',
    (monto) => {
      expect(parsearMonto(monto)).toBeNull();
      expect(() => aCentavos(monto)).toThrow('Monto no válido');
    },
  );

  it('acepta el máximo que cabe en Decimal(12,2)', () => {
    expect(deCentavos(aCentavos('9999999999.99'))).toBe('9999999999.99');
  });

  it('da siempre 2 decimales', () => {
    expect(deCentavos(5)).toBe('0.05');
    expect(deCentavos(100)).toBe('1.00');
    expect(deCentavos(125050)).toBe('1250.50');
    expect(deCentavos(0)).toBe('0.00');
  });

  it('rechaza cantidades de centavos imposibles', () => {
    expect(() => deCentavos(-1)).toThrow('no válida');
    expect(() => deCentavos(1.5)).toThrow('no válida');
  });
});
