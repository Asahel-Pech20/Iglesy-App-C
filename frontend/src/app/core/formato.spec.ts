import { describe, expect, it } from 'vitest';
import {
  aFechaApi,
  ETIQUETAS_ROL,
  formatearFecha,
  formatearFechaHora,
  formatearFechaLarga,
  formatearMoneda,
  opcionesDe,
} from './formato';

describe('lib/formato', () => {
  it('formatearFecha usa dd/MM/yyyy y no resta un día a las fechas @db.Date', () => {
    expect(formatearFecha('2026-10-30')).toBe('30/10/2026');
    expect(formatearFecha(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('formatearFechaHora usa dd/MM/yyyy HH:mm', () => {
    expect(formatearFechaHora(new Date(2026, 9, 30, 18, 5))).toBe('30/10/2026 18:05');
  });

  it('formatearFechaLarga en español', () => {
    expect(formatearFechaLarga('2026-10-30')).toBe('viernes, 30 de octubre de 2026');
  });

  it('devuelve "—" para valores vacíos o inválidos', () => {
    expect(formatearFecha(null)).toBe('—');
    expect(formatearFecha('no-es-fecha')).toBe('—');
    expect(formatearFechaHora(undefined)).toBe('—');
    expect(formatearMoneda(null)).toBe('—');
    expect(formatearMoneda('abc')).toBe('—');
  });

  it('formatearMoneda acepta el string de la API y respeta la moneda', () => {
    expect(formatearMoneda('15230.00')).toBe('$15,230.00');
    expect(formatearMoneda(1500.5, 'USD')).toContain('1,500.50');
    expect(formatearMoneda('0')).toBe('$0.00');
  });

  it('aFechaApi devuelve yyyy-MM-dd', () => {
    expect(aFechaApi(new Date(2026, 9, 3))).toBe('2026-10-03');
  });

  it('opcionesDe convierte etiquetas en opciones', () => {
    expect(opcionesDe(ETIQUETAS_ROL)).toContainEqual({
      valor: 'ADMIN_IGLESIA',
      etiqueta: 'Administrador de iglesia',
    });
    expect(opcionesDe(ETIQUETAS_ROL)).toHaveLength(6);
  });
});
