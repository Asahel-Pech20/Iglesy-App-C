import { describe, expect, it } from 'vitest';
import { aCentavos } from './dinero';
import { agruparDiezmo, resumirPeriodo, type CapturaReporte } from './reportes';
import { SUPUESTOS_DIEZMO } from './supuestos';

const CDMX = 'America/Mexico_City'; // UTC−6 en noviembre de 2026
const TIJUANA = 'America/Tijuana'; // UTC−8 en noviembre de 2026

// Las cuatro misas del criterio CA-23 (hora de la Ciudad de México):
//   dom 12:00 Luis 1000.10 · dom 18:00 Luis 500.20 · lun 12:00 Juan 750.30 · lun 18:00 Juan 250.40
// El domingo a las 18:00 local ya es lunes en UTC: así se prueba que se agrupa por hora local.
const captura = (
  misaId: string,
  inicioUtc: string,
  monto: string,
  padreId: string,
): CapturaReporte => ({ misaId, inicio: new Date(inicioUtc), monto, padreId });
const SEMANA = [
  captura('m1', '2026-11-08T18:00:00.000Z', '1000.10', 'Luis Pérez'),
  captura('m2', '2026-11-09T00:00:00.000Z', '500.20', 'Luis Pérez'),
  captura('m3', '2026-11-09T18:00:00.000Z', '750.30', 'Juan Gómez'),
  captura('m4', '2026-11-10T00:00:00.000Z', '250.40', 'Juan Gómez'),
];

describe('resumen del periodo (RF-64, RF-65, RN-45)', () => {
  it('CA-23: total 2501.00, promedio 625.25, más 1000.10 y menos 250.40', () => {
    const resumen = resumirPeriodo(SEMANA);
    expect(resumen.misas).toBe(4);
    expect(resumen.total).toBe('2501.00');
    expect(resumen.promedio).toBe('625.25');
    expect(resumen.conMas).toEqual([{ misaId: 'm1', inicio: SEMANA[0]!.inicio, monto: '1000.10' }]);
    expect(resumen.conMenos).toEqual([
      { misaId: 'm4', inicio: SEMANA[3]!.inicio, monto: '250.40' },
    ]);
  });

  it('RN-44: suma al centavo montos que en punto flotante fallarían', () => {
    const resumen = resumirPeriodo([
      captura('a', '2026-11-08T18:00:00.000Z', '0.10', 'p'),
      captura('b', '2026-11-09T18:00:00.000Z', '0.20', 'p'),
    ]);
    expect(resumen.total).toBe('0.30');
    expect(resumen.promedio).toBe('0.15');
  });

  it('sin misas con diezmo: total 0.00, sin promedio y sin extremos', () => {
    expect(resumirPeriodo([])).toEqual({
      misas: 0,
      total: '0.00',
      promedio: null,
      conMas: [],
      conMenos: [],
    });
  });

  it('una sola misa es a la vez la de más y la de menos', () => {
    const resumen = resumirPeriodo([SEMANA[0]!]);
    expect(resumen.promedio).toBe('1000.10');
    expect(resumen.conMas[0]?.misaId).toBe('m1');
    expect(resumen.conMenos[0]?.misaId).toBe('m1');
  });

  it('redondea el promedio al centavo, la mitad hacia arriba (supuesto P-23)', () => {
    const tres = (a: string, b: string, c: string) =>
      resumirPeriodo([
        captura('a', '2026-11-08T18:00:00.000Z', a, 'p'),
        captura('b', '2026-11-09T18:00:00.000Z', b, 'p'),
        captura('c', '2026-11-10T18:00:00.000Z', c, 'p'),
      ]).promedio;
    expect(tres('0.00', '0.00', '1.00')).toBe('0.33'); // 100 / 3 = 33.33 → 33
    expect(tres('0.00', '1.00', '1.00')).toBe('0.67'); // 200 / 3 = 66.67 → 67
    expect(
      resumirPeriodo([
        captura('a', '2026-11-08T18:00:00.000Z', '0.01', 'p'),
        captura('b', '2026-11-09T18:00:00.000Z', '0.02', 'p'),
      ]).promedio,
    ).toBe('0.02'); // 3 / 2 = 1.5 → 2
  });

  it('empates: primero la misa más antigua (supuesto P-23)', () => {
    const resumen = resumirPeriodo([
      captura('tarde', '2026-11-10T18:00:00.000Z', '100.00', 'p'),
      captura('temprano', '2026-11-08T18:00:00.000Z', '100.00', 'p'),
    ]);
    expect(resumen.conMas[0]?.misaId).toBe('temprano');
    expect(resumen.conMenos[0]?.misaId).toBe('temprano');
  });

  it('P-23: si el cliente pide más de una, basta cambiar cuantasMisasExtremas', () => {
    const tres = { ...SUPUESTOS_DIEZMO, cuantasMisasExtremas: 3 };
    const resumen = resumirPeriodo(SEMANA, tres);
    expect(resumen.conMas.map((m) => m.monto)).toEqual(['1000.10', '750.30', '500.20']);
    expect(resumen.conMenos.map((m) => m.monto)).toEqual(['250.40', '500.20', '750.30']);
    // Pedir más de las que hay devuelve todas
    expect(resumirPeriodo(SEMANA, { ...tres, cuantasMisasExtremas: 10 }).conMas).toHaveLength(4);
  });

  it('no modifica la lista que recibe', () => {
    const copia = [...SEMANA];
    resumirPeriodo(SEMANA);
    expect(SEMANA).toEqual(copia);
  });
});

describe('diezmo agrupado (RF-66–RF-68)', () => {
  it('CA-24: por día en la hora local de la iglesia, no en UTC', () => {
    expect(agruparDiezmo(SEMANA, 'DIA', CDMX)).toEqual([
      { clave: '2026-11-08', misas: 2, total: '1500.30' },
      { clave: '2026-11-09', misas: 2, total: '1000.70' },
    ]);
  });

  it('CA-24: por horario de misa (hora local de inicio)', () => {
    expect(agruparDiezmo(SEMANA, 'HORARIO', CDMX)).toEqual([
      { clave: '12:00', misas: 2, total: '1750.40' },
      { clave: '18:00', misas: 2, total: '750.60' },
    ]);
  });

  it('CA-24: por padre', () => {
    expect(agruparDiezmo(SEMANA, 'PADRE', CDMX)).toEqual([
      { clave: 'Juan Gómez', misas: 2, total: '1000.70' },
      { clave: 'Luis Pérez', misas: 2, total: '1500.30' },
    ]);
  });

  it('CA-24: cada agrupación suma lo mismo que el total del periodo', () => {
    const total = resumirPeriodo(SEMANA).total;
    for (const criterio of ['DIA', 'SEMANA', 'MES', 'HORARIO', 'PADRE'] as const) {
      const grupos = agruparDiezmo(SEMANA, criterio, CDMX);
      const centavos = grupos.reduce((s, g) => s + aCentavos(g.total), 0);
      expect(centavos).toBe(aCentavos(total));
      expect(grupos.reduce((s, g) => s + g.misas, 0)).toBe(4);
    }
  });

  it('por mes', () => {
    expect(agruparDiezmo(SEMANA, 'MES', CDMX)).toEqual([
      { clave: '2026-11', misas: 4, total: '2501.00' },
    ]);
  });

  it('por semana: empieza en lunes con los supuestos de hoy (P-23)', () => {
    // El domingo 8 pertenece a la semana que empezó el lunes 2; el lunes 9 abre la siguiente
    expect(agruparDiezmo(SEMANA, 'SEMANA', CDMX)).toEqual([
      { clave: '2026-11-02', misas: 2, total: '1500.30' },
      { clave: '2026-11-09', misas: 2, total: '1000.70' },
    ]);
  });

  it('P-23: si la semana empieza en domingo, basta cambiar inicioDeSemana', () => {
    const domingo = { ...SUPUESTOS_DIEZMO, inicioDeSemana: 0 } as const;
    expect(agruparDiezmo(SEMANA, 'SEMANA', CDMX, domingo)).toEqual([
      { clave: '2026-11-08', misas: 4, total: '2501.00' },
    ]);
  });

  it('RN-31: el mismo instante cae en otro día y horario según la zona horaria de la iglesia', () => {
    // En Tijuana (UTC−8) las mismas misas son a las 10:00 y a las 16:00
    expect(agruparDiezmo(SEMANA, 'HORARIO', TIJUANA)).toEqual([
      { clave: '10:00', misas: 2, total: '1750.40' },
      { clave: '16:00', misas: 2, total: '750.60' },
    ]);
  });

  it('una misa de las 23:30 locales queda en su día local y no en el siguiente de UTC', () => {
    const tarde = captura('x', '2026-11-09T05:30:00.000Z', '10.00', 'p'); // 23:30 del 8 en CDMX
    expect(agruparDiezmo([tarde], 'DIA', CDMX)).toEqual([
      { clave: '2026-11-08', misas: 1, total: '10.00' },
    ]);
    expect(agruparDiezmo([tarde], 'HORARIO', CDMX)[0]?.clave).toBe('23:30');
  });

  it('sin capturas devuelve una lista vacía', () => {
    expect(agruparDiezmo([], 'DIA', CDMX)).toEqual([]);
  });

  it('rechaza una zona horaria inexistente en vez de adivinar', () => {
    expect(() => agruparDiezmo(SEMANA, 'DIA', 'Marte/Olympus')).toThrow();
  });
});
