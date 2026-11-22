// E1-04 (RNF-07, RN-31): hora local de cada iglesia. Funciones puras: no usan la BD ni el reloj.
import { describe, expect, it } from 'vitest';
import { desfaseDeZona, esZonaValida, fechaYHoraLocal, instanteLocal, partesLocales } from './zona';

const CDMX = 'America/Mexico_City'; // UTC−6 todo el año (sin horario de verano desde 2022)
const TIJUANA = 'America/Tijuana'; // UTC−8 / UTC−7: sí cambia de horario
const CANCUN = 'America/Cancun'; // UTC−5

describe('de instante a hora local', () => {
  it('el mismo instante es otra hora en cada zona de México', () => {
    const instante = new Date('2026-11-18T18:00:00.000Z');
    expect(fechaYHoraLocal(instante, CDMX)).toEqual({ fecha: '2026-11-18', hora: '12:00' });
    expect(fechaYHoraLocal(instante, TIJUANA)).toEqual({ fecha: '2026-11-18', hora: '10:00' });
    expect(fechaYHoraLocal(instante, CANCUN)).toEqual({ fecha: '2026-11-18', hora: '13:00' });
  });

  it('cambia de día cuando en UTC ya es mañana pero en la iglesia todavía no', () => {
    const instante = new Date('2026-11-19T03:30:00.000Z');
    expect(fechaYHoraLocal(instante, CDMX)).toEqual({ fecha: '2026-11-18', hora: '21:30' });
  });

  it('usa reloj de 24 horas y separa las partes', () => {
    const p = partesLocales(new Date('2026-01-01T05:59:59.000Z'), CDMX);
    expect(p).toEqual({ anio: 2025, mes: 12, dia: 31, hora: '23', minuto: '59', segundo: '59' });
  });

  it('calcula el desfase de la zona respecto a UTC, también con horario de verano', () => {
    const hora = 60 * 60 * 1000;
    expect(desfaseDeZona(Date.parse('2026-07-01T12:00:00Z'), CDMX)).toBe(-6 * hora);
    expect(desfaseDeZona(Date.parse('2026-01-15T12:00:00Z'), TIJUANA)).toBe(-8 * hora);
    expect(desfaseDeZona(Date.parse('2026-07-01T12:00:00Z'), TIJUANA)).toBe(-7 * hora);
  });
});

describe('de hora local a instante (para guardar misas y horarios)', () => {
  it('es la inversa de fechaYHoraLocal', () => {
    for (const zona of [CDMX, TIJUANA, CANCUN]) {
      const instante = instanteLocal('2026-11-18', '19:30', zona);
      expect(instante).not.toBeNull();
      expect(fechaYHoraLocal(instante as Date, zona)).toEqual({
        fecha: '2026-11-18',
        hora: '19:30',
      });
    }
  });

  it('la misa de las 08:00 en la Ciudad de México es a las 14:00 UTC', () => {
    expect(instanteLocal('2026-11-22', '08:00', CDMX)?.toISOString()).toBe(
      '2026-11-22T14:00:00.000Z',
    );
  });

  it('una hora que no existe por el cambio de horario devuelve null (quien llama responde 422)', () => {
    // Tijuana adelanta el reloj el 8 de marzo de 2026 a las 02:00: de 01:59 pasa a 03:00
    expect(instanteLocal('2026-03-08', '02:30', TIJUANA)).toBeNull();
    expect(instanteLocal('2026-03-08', '03:00', TIJUANA)?.toISOString()).toBe(
      '2026-03-08T10:00:00.000Z',
    );
  });

  it('una hora que ocurre dos veces toma la primera', () => {
    // Tijuana atrasa el reloj el 1 de noviembre de 2026 a las 02:00: la 01:30 ocurre dos veces
    expect(instanteLocal('2026-11-01', '01:30', TIJUANA)?.toISOString()).toBe(
      '2026-11-01T08:30:00.000Z',
    );
  });

  it('rechaza fechas, horas o zonas inválidas en vez de adivinar', () => {
    expect(instanteLocal('2026-02-30', '10:00', CDMX)).toBeNull();
    expect(instanteLocal('2026-11-18', '24:00', CDMX)).toBeNull();
    expect(instanteLocal('2026-11-18', '9:00', CDMX)).toBeNull();
    expect(instanteLocal('18/11/2026', '10:00', CDMX)).toBeNull();
    expect(instanteLocal('2026-11-18', '10:00', 'America/Narnia')).toBeNull();
  });
});

describe('zonas horarias válidas', () => {
  it('reconoce las zonas IANA y rechaza las inventadas', () => {
    expect(esZonaValida(CDMX)).toBe(true);
    expect(esZonaValida(TIJUANA)).toBe(true);
    expect(esZonaValida('America/Narnia')).toBe(false);
    expect(esZonaValida('')).toBe(false);
  });
});
