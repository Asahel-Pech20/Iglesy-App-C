import { describe, expect, it } from 'vitest';
import { evaluarCaptura, evaluarCorreccion, misaCelebrada, type MisaParaDiezmo } from './captura';
import { SUPUESTOS_DIEZMO } from './supuestos';

// El «ahora» de todas las pruebas es un instante fijo: nunca se lee el reloj real.
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const celebrada: MisaParaDiezmo = {
  inicio: new Date('2026-11-08T18:00:00.000Z'), // domingo 12:00 hora de la Ciudad de México
  celebracionRegistrada: true,
};
const futura: MisaParaDiezmo = {
  inicio: new Date('2026-11-11T18:00:00.000Z'),
  celebracionRegistrada: false,
};

describe('captura de diezmo (RN-40, RN-41)', () => {
  it('CA-20: se captura el diezmo de una misa celebrada que todavía no tiene captura', () => {
    // Dado la misa del domingo a las 12:00, sin diezmo; Cuando el tesorero captura 1250.50
    expect(evaluarCaptura(celebrada, '1250.50', false, AHORA)).toEqual({
      ok: true,
      monto: '1250.50',
      centavos: 125050,
    });
  });

  it('CA-20: la segunda captura de la misma misa se rechaza y se debe corregir', () => {
    expect(evaluarCaptura(celebrada, '999.00', true, AHORA)).toEqual({
      ok: false,
      motivo: 'YA_TIENE_CAPTURA',
    });
  });

  it('CA-21: no se captura el diezmo de una misa que todavía no se celebra', () => {
    expect(evaluarCaptura(futura, '100.00', false, AHORA)).toEqual({
      ok: false,
      motivo: 'MISA_NO_CELEBRADA',
    });
  });

  it('RN-40: una misa pasada sin celebración registrada no cuenta como celebrada (supuesto P-22)', () => {
    const sinRegistro = { ...celebrada, celebracionRegistrada: false };
    expect(misaCelebrada(sinRegistro, AHORA)).toBe(false);
    expect(evaluarCaptura(sinRegistro, '100.00', false, AHORA).ok).toBe(false);
  });

  it('RN-40: una misa registrada pero cuya hora no ha llegado tampoco cuenta', () => {
    expect(misaCelebrada({ ...futura, celebracionRegistrada: true }, AHORA)).toBe(false);
  });

  it('RN-40: en el instante exacto de inicio la misa ya cuenta; un milisegundo antes no', () => {
    const inicio = new Date('2026-11-10T15:00:00.000Z');
    const misa = { inicio, celebracionRegistrada: true };
    expect(misaCelebrada(misa, AHORA)).toBe(true);
    expect(misaCelebrada(misa, new Date(inicio.getTime() - 1))).toBe(false);
  });

  it('RN-44: rechaza montos con formato inválido, negativos o con más de 2 decimales', () => {
    for (const monto of ['', 'abc', '-5', '12.345', '1,250.50']) {
      expect(evaluarCaptura(celebrada, monto, false, AHORA)).toEqual({
        ok: false,
        motivo: 'MONTO_INVALIDO',
      });
    }
  });

  it('el monto inválido se reporta antes que los demás problemas', () => {
    expect(evaluarCaptura(futura, 'abc', true, AHORA)).toEqual({
      ok: false,
      motivo: 'MONTO_INVALIDO',
    });
  });

  it('normaliza el monto a 2 decimales', () => {
    expect(evaluarCaptura(celebrada, '1250.5', false, AHORA)).toMatchObject({ monto: '1250.50' });
  });

  it('P-22: cero se acepta con los supuestos de hoy (no se recogió nada)', () => {
    expect(evaluarCaptura(celebrada, '0.00', false, AHORA)).toMatchObject({
      ok: true,
      centavos: 0,
    });
  });

  it('P-22: si el cliente no permite cero, basta cambiar permiteMontoCero', () => {
    const sinCero = { ...SUPUESTOS_DIEZMO, permiteMontoCero: false };
    expect(evaluarCaptura(celebrada, '0.00', false, AHORA, sinCero)).toEqual({
      ok: false,
      motivo: 'MONTO_INVALIDO',
    });
  });

  it('P-22: si basta la hora de la misa, basta cambiar exigeRegistroDeCelebracion', () => {
    const soloHora = { ...SUPUESTOS_DIEZMO, exigeRegistroDeCelebracion: false };
    const sinRegistro = { ...celebrada, celebracionRegistrada: false };
    expect(evaluarCaptura(sinRegistro, '100.00', false, AHORA, soloHora).ok).toBe(true);
    // Aun así, una misa futura no se captura
    expect(evaluarCaptura(futura, '100.00', false, AHORA, soloHora).ok).toBe(false);
  });
});

describe('corrección de diezmo (RN-42, RN-43)', () => {
  it('CA-22: la corrección guarda quién, cuándo y la cantidad anterior', () => {
    // Dado la captura de 1250.50; Cuando el tesorero corrige a 1520.50
    const resultado = evaluarCorreccion('1250.50', '1520.50', 'tesorero-1', AHORA);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.correccion).toEqual({
      anterior: '1250.50',
      nuevo: '1520.50',
      hechaPor: 'tesorero-1',
      hechaEn: AHORA,
    });
  });

  it('CA-22: el registro no se puede editar', () => {
    const resultado = evaluarCorreccion('1250.50', '1520.50', 'tesorero-1', AHORA);
    if (!resultado.ok) throw new Error('la corrección debía ser válida');
    expect(Object.isFrozen(resultado.correccion)).toBe(true);
  });

  it('el registro guarda su propia copia de la fecha', () => {
    const ahora = new Date(AHORA.getTime());
    const resultado = evaluarCorreccion('10.00', '20.00', 'tesorero-1', ahora);
    if (!resultado.ok) throw new Error('la corrección debía ser válida');
    ahora.setUTCFullYear(2000);
    expect(resultado.correccion.hechaEn).toEqual(AHORA);
  });

  it('compara en centavos: «1250.5» y «1250.50» son el mismo monto (supuesto P-22)', () => {
    expect(evaluarCorreccion('1250.50', '1250.5', 'tesorero-1', AHORA)).toEqual({
      ok: false,
      motivo: 'SIN_CAMBIO',
    });
  });

  it('si el cliente acepta correcciones sin cambio, basta cambiar rechazaCorreccionSinCambio', () => {
    const permisivo = { ...SUPUESTOS_DIEZMO, rechazaCorreccionSinCambio: false };
    expect(evaluarCorreccion('10.00', '10.00', 'tesorero-1', AHORA, permisivo).ok).toBe(true);
  });

  it('rechaza un monto nuevo inválido', () => {
    expect(evaluarCorreccion('10.00', '12.345', 'tesorero-1', AHORA)).toEqual({
      ok: false,
      motivo: 'MONTO_INVALIDO',
    });
  });

  it('una corrección sin autor es un dato incoherente y falla', () => {
    expect(() => evaluarCorreccion('10.00', '20.00', '  ', AHORA)).toThrow('quién la hizo');
  });

  it('el monto actual que viene de la BD debe ser válido', () => {
    expect(() => evaluarCorreccion('mal', '20.00', 'tesorero-1', AHORA)).toThrow('Monto no válido');
  });
});
