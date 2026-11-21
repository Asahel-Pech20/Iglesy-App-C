import { describe, expect, it } from 'vitest';
import { SUPUESTOS } from './supuestos';
import { cotizacionVencida, fechaVencimiento } from './vigencia-cotizacion';

const DIA = 24 * 60 * 60 * 1000;
// El «ahora» de todas las pruebas es un instante fijo: nunca se lee el reloj real.
const EMITIDA = new Date('2026-11-01T10:00:00.000Z');
const despues = (ms: number) => new Date(EMITIDA.getTime() + ms);

describe('vigencia de la cotización (RN-51, RF-79)', () => {
  it('RN-51: la cotización vale 15 días contados desde que se emite', () => {
    expect(fechaVencimiento(EMITIDA)).toEqual(new Date('2026-11-16T10:00:00.000Z'));
    expect(SUPUESTOS.vigenciaDias).toBe(15);
  });

  it('RN-51: sigue vigente un milisegundo antes de cumplir los 15 días', () => {
    expect(cotizacionVencida(EMITIDA, despues(15 * DIA - 1))).toBe(false);
    expect(
      cotizacionVencida(EMITIDA, despues(14 * DIA + 23 * 3_600_000 + 59 * 60_000 + 59_999)),
    ).toBe(false);
  });

  it('RN-51: vence en el instante exacto en que se cumplen los 15 días (supuesto P-26)', () => {
    expect(cotizacionVencida(EMITIDA, despues(15 * DIA))).toBe(true);
  });

  it('RN-51: un milisegundo después del límite sigue vencida', () => {
    expect(cotizacionVencida(EMITIDA, despues(15 * DIA + 1))).toBe(true);
    expect(cotizacionVencida(EMITIDA, despues(40 * DIA))).toBe(true);
  });

  it('una cotización recién emitida o con emisión futura no está vencida', () => {
    expect(cotizacionVencida(EMITIDA, EMITIDA)).toBe(false);
    expect(cotizacionVencida(EMITIDA, despues(-DIA))).toBe(false);
  });

  it('los 15 días son 360 horas exactas, sin importar un cambio de horario', () => {
    // Del 25 de octubre al 9 de noviembre de 2026 cambia el horario de varias zonas de México
    const emitida = new Date('2026-10-25T07:00:00.000Z');
    expect(fechaVencimiento(emitida).getTime() - emitida.getTime()).toBe(360 * 3_600_000);
  });

  it('no modifica la fecha que recibe', () => {
    const emitida = new Date(EMITIDA.getTime());
    fechaVencimiento(emitida);
    cotizacionVencida(emitida, despues(20 * DIA));
    expect(emitida).toEqual(EMITIDA);
  });

  it('rechaza fechas inválidas en vez de adivinar', () => {
    const invalida = new Date('no es una fecha');
    expect(() => fechaVencimiento(invalida)).toThrow('fecha de emisión');
    expect(() => cotizacionVencida(EMITIDA, invalida)).toThrow('instante actual');
  });

  it('P-26: cambiando solo los supuestos cambia el límite (días y límite inclusivo)', () => {
    const diezDias = { ...SUPUESTOS, vigenciaDias: 10 };
    expect(cotizacionVencida(EMITIDA, despues(10 * DIA), diezDias)).toBe(true);
    expect(cotizacionVencida(EMITIDA, despues(10 * DIA - 1), diezDias)).toBe(false);

    const hastaPasarElLimite = { ...SUPUESTOS, vencidaEnElInstanteLimite: false };
    expect(cotizacionVencida(EMITIDA, despues(15 * DIA), hastaPasarElLimite)).toBe(false);
    expect(cotizacionVencida(EMITIDA, despues(15 * DIA + 1), hastaPasarElLimite)).toBe(true);
  });
});
