import { describe, expect, it } from 'vitest';
import { diaSiguiente, esFechaValida, inicioDelDia, resolverPeriodo } from './periodo';

const CDMX = 'America/Mexico_City'; // UTC−6 todo el año desde 2022
const TIJUANA = 'America/Tijuana'; // UTC−8 en noviembre
const NUEVA_YORK = 'America/New_York'; // tiene cambio de horario: se usa para los días de 23 y 25 horas
const HORA = 3_600_000;

describe('fechas del calendario', () => {
  it('reconoce fechas reales y rechaza las que no existen', () => {
    expect(esFechaValida('2026-11-08')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true); // año bisiesto
    for (const mala of ['2026-02-30', '2026-13-01', '2026-11-31', '2026-1-1', '', 'hoy']) {
      expect(esFechaValida(mala), mala).toBe(false);
    }
  });

  it('calcula el día siguiente, también al cambiar de mes y de año', () => {
    expect(diaSiguiente('2026-11-08')).toBe('2026-11-09');
    expect(diaSiguiente('2026-11-30')).toBe('2026-12-01');
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
    expect(diaSiguiente('2028-02-28')).toBe('2028-02-29');
  });
});

describe('inicio del día en la zona horaria de la iglesia', () => {
  it('la medianoche local es seis horas después de la de UTC en la Ciudad de México', () => {
    expect(inicioDelDia('2026-11-08', CDMX)).toEqual(new Date('2026-11-08T06:00:00.000Z'));
  });

  it('en Tijuana la misma fecha empieza dos horas más tarde', () => {
    expect(inicioDelDia('2026-11-08', TIJUANA)).toEqual(new Date('2026-11-08T08:00:00.000Z'));
  });

  it('un día con cambio de horario dura 23 horas en primavera y 25 en otoño', () => {
    const dura = (fecha: string) =>
      inicioDelDia(diaSiguiente(fecha), NUEVA_YORK).getTime() -
      inicioDelDia(fecha, NUEVA_YORK).getTime();
    expect(dura('2026-03-08')).toBe(23 * HORA);
    expect(dura('2026-11-01')).toBe(25 * HORA);
    expect(dura('2026-06-10')).toBe(24 * HORA);
  });

  it('rechaza una fecha inexistente en vez de adivinar', () => {
    expect(() => inicioDelDia('2026-02-30', CDMX)).toThrow('Fecha no válida');
  });
});

describe('periodo del reporte', () => {
  const AHORA = new Date('2026-11-10T15:00:00.000Z'); // martes 10 de noviembre, 09:00 en la Ciudad de México

  it('sin fechas es el mes en curso de la iglesia (supuesto de diseño)', () => {
    const r = resolverPeriodo(undefined, undefined, CDMX, AHORA);
    expect(r.ok && r.periodo).toMatchObject({ desde: '2026-11-01', hasta: '2026-11-30' });
    if (r.ok) {
      expect(r.periodo.inicio).toEqual(new Date('2026-11-01T06:00:00.000Z'));
      expect(r.periodo.finExcluido).toEqual(new Date('2026-12-01T06:00:00.000Z'));
    }
  });

  it('el mes en curso se cuenta en la hora local, no en UTC', () => {
    // 2026-12-01 03:00 UTC todavía es 30 de noviembre, 21:00, en la Ciudad de México
    const r = resolverPeriodo(undefined, undefined, CDMX, new Date('2026-12-01T03:00:00.000Z'));
    expect(r.ok && r.periodo.desde).toBe('2026-11-01');
    // En diciembre de un año bisiesto, el último día del mes también sale bien
    const febrero = resolverPeriodo(
      undefined,
      undefined,
      CDMX,
      new Date('2028-02-10T18:00:00.000Z'),
    );
    expect(febrero.ok && febrero.periodo.hasta).toBe('2028-02-29');
  });

  it('un rango incluye el día final completo: termina al empezar el día siguiente', () => {
    const r = resolverPeriodo('2026-11-02', '2026-11-08', CDMX, AHORA);
    if (!r.ok) throw new Error('el periodo debía ser válido');
    expect(r.periodo.inicio).toEqual(new Date('2026-11-02T06:00:00.000Z'));
    expect(r.periodo.finExcluido).toEqual(new Date('2026-11-09T06:00:00.000Z'));
    // Una misa del domingo 8 a las 18:00 locales (lunes 00:00 UTC) cae dentro
    const misa = new Date('2026-11-09T00:00:00.000Z').getTime();
    expect(misa >= r.periodo.inicio.getTime() && misa < r.periodo.finExcluido.getTime()).toBe(true);
  });

  it('con una sola fecha el periodo es ese día', () => {
    for (const [desde, hasta] of [
      ['2026-11-05', undefined],
      [undefined, '2026-11-05'],
    ] as const) {
      const r = resolverPeriodo(desde, hasta, CDMX, AHORA);
      expect(r.ok && r.periodo).toMatchObject({ desde: '2026-11-05', hasta: '2026-11-05' });
    }
  });

  it('rechaza fechas inválidas y rangos invertidos', () => {
    expect(resolverPeriodo('2026-02-30', '2026-03-01', CDMX, AHORA)).toEqual({
      ok: false,
      motivo: 'FECHA_INVALIDA',
    });
    expect(resolverPeriodo('2026-11-09', '2026-11-02', CDMX, AHORA)).toEqual({
      ok: false,
      motivo: 'RANGO_INVERTIDO',
    });
  });
});
