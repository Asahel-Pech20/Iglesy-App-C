import { describe, expect, it } from 'vitest';
import {
  buscarChoque,
  buscarChoqueEnIntervalo,
  describirEnZona,
  diaDeLaSemana,
  domingoDeLaSemana,
  duracionEfectiva,
  DURACION_POR_DEFECTO_MIN,
  intervaloCelebrada,
  intervaloEnSemana,
  puedeRegistrarCelebracion,
  seEmpalman,
  semanasDeReferencia,
  sumarDias,
  type MisaProgramada,
} from './solapes';

const CDMX = 'America/Mexico_City'; // UTC-6 todo el año
const CANCUN = 'America/Cancun'; // UTC-5 todo el año
const TIJUANA = 'America/Tijuana'; // UTC-8 en invierno, UTC-7 en verano

// Domingo 22 de noviembre de 2026
const DOMINGO = '2026-11-22';
const AHORA = new Date('2026-11-25T18:00:00.000Z');

const misa = (datos: Partial<MisaProgramada> & Pick<MisaProgramada, 'diaSemana' | 'hora'>) =>
  ({ iglesiaId: 'iglesia-a', zonaHoraria: CDMX, ...datos }) as MisaProgramada;

describe('duración de una misa (RN-27)', () => {
  it('es de una hora si no se indica otra', () => {
    expect(DURACION_POR_DEFECTO_MIN).toBe(60);
    expect(duracionEfectiva(undefined)).toBe(60);
    expect(duracionEfectiva(null)).toBe(60);
  });

  it('acepta otra duración entera', () => {
    expect(duracionEfectiva(90)).toBe(90);
    expect(duracionEfectiva(1)).toBe(1);
    expect(duracionEfectiva(720)).toBe(720);
  });

  it('rechaza duraciones no enteras, en cero, negativas o mayores de 12 horas', () => {
    for (const d of [0, -30, 45.5, 721, Number.NaN]) {
      expect(() => duracionEfectiva(d)).toThrow();
    }
  });
});

describe('calendario', () => {
  it('suma días y cruza meses y años', () => {
    expect(sumarDias('2026-11-22', 6)).toBe('2026-11-28');
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('calcula el día de la semana con 0 = domingo', () => {
    expect(diaDeLaSemana('2026-11-22')).toBe(0);
    expect(diaDeLaSemana('2026-11-25')).toBe(3);
    expect(diaDeLaSemana('2026-11-28')).toBe(6);
  });

  it('encuentra el domingo con que empieza la semana', () => {
    expect(domingoDeLaSemana('2026-11-25')).toBe(DOMINGO);
    expect(domingoDeLaSemana(DOMINGO)).toBe(DOMINGO);
    expect(domingoDeLaSemana('2026-11-28')).toBe(DOMINGO);
  });

  it('rechaza fechas mal escritas', () => {
    expect(() => sumarDias('22/11/2026', 1)).toThrow();
    expect(() => diaDeLaSemana('2026-1-5')).toThrow();
  });
});

describe('hora local de la iglesia (RN-31)', () => {
  it('convierte la hora local de cada iglesia a su momento real', () => {
    const cdmx = intervaloEnSemana(misa({ diaSemana: 0, hora: '10:00' }), DOMINGO);
    expect(cdmx?.inicio.toISOString()).toBe('2026-11-22T16:00:00.000Z');
    expect(cdmx?.fin.toISOString()).toBe('2026-11-22T17:00:00.000Z');

    const cancun = intervaloEnSemana(
      misa({ diaSemana: 0, hora: '10:00', zonaHoraria: CANCUN }),
      DOMINGO,
    );
    expect(cancun?.inicio.toISOString()).toBe('2026-11-22T15:00:00.000Z');
  });

  it('usa el día de la semana dentro de la semana indicada', () => {
    const sabado = intervaloEnSemana(misa({ diaSemana: 6, hora: '19:00' }), DOMINGO);
    expect(sabado?.inicio.toISOString()).toBe('2026-11-29T01:00:00.000Z');
  });

  it('devuelve el día y la hora locales para el mensaje de choque', () => {
    const intervalo = intervaloEnSemana(misa({ diaSemana: 0, hora: '10:00' }), DOMINGO);
    expect(intervalo).not.toBeNull();
    expect(describirEnZona(intervalo!, CDMX)).toEqual({
      diaSemana: 0,
      fecha: DOMINGO,
      hora: '10:00',
    });
  });
});

describe('empalme de intervalos (supuesto P-15)', () => {
  const de = (inicio: string, fin: string) => ({ inicio: new Date(inicio), fin: new Date(fin) });

  it('se empalman si comparten algún momento', () => {
    expect(
      seEmpalman(
        de('2026-11-22T16:00:00Z', '2026-11-22T17:00:00Z'),
        de('2026-11-22T16:30:00Z', '2026-11-22T17:30:00Z'),
      ),
    ).toBe(true);
  });

  it('misas seguidas no se empalman', () => {
    expect(
      seEmpalman(
        de('2026-11-22T16:00:00Z', '2026-11-22T17:00:00Z'),
        de('2026-11-22T17:00:00Z', '2026-11-22T18:00:00Z'),
      ),
    ).toBe(false);
  });
});

describe('choques de un padre (RN-26, RF-45)', () => {
  const semanas = [DOMINGO];

  it('rechaza dos misas a la misma hora en la misma iglesia', () => {
    const existente = misa({ id: 'h1', diaSemana: 0, hora: '10:00' });
    const choque = buscarChoque(misa({ diaSemana: 0, hora: '10:00' }), [existente], semanas);
    expect(choque?.misa.id).toBe('h1');
  });

  it('rechaza dos misas a la misma hora en templos distintos', () => {
    const existente = misa({ id: 'h1', iglesiaId: 'iglesia-b', diaSemana: 0, hora: '10:00' });
    const choque = buscarChoque(misa({ diaSemana: 0, hora: '10:00' }), [existente], semanas);
    expect(choque?.misa.iglesiaId).toBe('iglesia-b');
    expect(choque?.intervalo.inicio.toISOString()).toBe('2026-11-22T16:00:00.000Z');
  });

  it('cuenta el empalme por la duración, no solo la hora de inicio', () => {
    const larga = misa({ id: 'h1', diaSemana: 0, hora: '10:00', duracionMin: 90 });
    expect(buscarChoque(misa({ diaSemana: 0, hora: '11:00' }), [larga], semanas)).not.toBeNull();

    const normal = misa({ id: 'h2', diaSemana: 0, hora: '10:00' });
    expect(buscarChoque(misa({ diaSemana: 0, hora: '11:00' }), [normal], semanas)).toBeNull();
  });

  it('permite misas en días distintos', () => {
    const existente = misa({ id: 'h1', diaSemana: 0, hora: '10:00' });
    expect(buscarChoque(misa({ diaSemana: 1, hora: '10:00' }), [existente], semanas)).toBeNull();
  });

  it('compara el momento real entre zonas horarias distintas', () => {
    // 11:00 en Cancún (UTC-5) es el mismo momento que 10:00 en la Ciudad de México (UTC-6)
    const cancun = misa({
      id: 'h1',
      iglesiaId: 'iglesia-b',
      diaSemana: 0,
      hora: '11:00',
      zonaHoraria: CANCUN,
    });
    expect(buscarChoque(misa({ diaSemana: 0, hora: '10:00' }), [cancun], semanas)).not.toBeNull();

    // 10:00 en Cancún termina justo cuando empieza la de las 10:00 en la Ciudad de México
    const seguida = misa({ ...cancun, id: 'h2', hora: '10:00' });
    expect(buscarChoque(misa({ diaSemana: 0, hora: '10:00' }), [seguida], semanas)).toBeNull();
  });

  it('ignora la propia misa al editarla', () => {
    const existente = misa({ id: 'h1', diaSemana: 0, hora: '10:00' });
    const editada = misa({ id: 'h1', diaSemana: 0, hora: '10:30' });
    expect(buscarChoque(editada, [existente], semanas)).toBeNull();
  });

  it('detecta choques que cruzan la medianoche del sábado al domingo', () => {
    const sabado = misa({ id: 'h1', diaSemana: 6, hora: '23:30' });
    expect(buscarChoque(misa({ diaSemana: 0, hora: '00:00' }), [sabado], semanas)).not.toBeNull();
  });

  it('sin otras misas no hay choque', () => {
    expect(buscarChoque(misa({ diaSemana: 0, hora: '10:00' }), [], semanas)).toBeNull();
  });
});

describe('cambio de horario de verano (frontera norte)', () => {
  // Tijuana 08:00 = 16:00 UTC en invierno y 15:00 UTC en verano; CDMX 09:00 = 15:00 UTC siempre
  const tijuana = misa({
    id: 'h1',
    iglesiaId: 'iglesia-tj',
    diaSemana: 0,
    hora: '08:00',
    zonaHoraria: TIJUANA,
  });
  const cdmx = misa({ diaSemana: 0, hora: '09:00' });

  it('en una semana de invierno no chocan', () => {
    expect(buscarChoque(cdmx, [tijuana], [DOMINGO])).toBeNull();
  });

  it('las semanas de referencia incluyen el verano y detectan el choque', () => {
    const semanas = semanasDeReferencia(AHORA);
    expect(semanas).toContain(DOMINGO);
    expect(semanas).toContain('2026-07-12');
    expect(semanas).toContain('2026-01-11');
    expect(buscarChoque(cdmx, [tijuana], semanas)).not.toBeNull();
  });

  it('las semanas de referencia no se repiten', () => {
    const enJulio = semanasDeReferencia(new Date('2026-07-15T12:00:00Z'));
    expect(new Set(enJulio).size).toBe(enJulio.length);
  });
});

describe('sustitución (supuesto P-17)', () => {
  const lunesMatutina = misa({
    id: 'h-lunes',
    iglesiaId: 'iglesia-b',
    diaSemana: 1,
    hora: '08:00',
  });

  it('rechaza a un sustituto que tiene otra misa a esa hora', () => {
    // Lunes 23 de noviembre, 08:30 en la Ciudad de México
    const intervalo = intervaloCelebrada(new Date('2026-11-23T14:30:00.000Z'));
    expect(buscarChoqueEnIntervalo(intervalo, [lunesMatutina])?.misa.id).toBe('h-lunes');
  });

  it('acepta al sustituto si está libre a esa hora', () => {
    const intervalo = intervaloCelebrada(new Date('2026-11-23T18:00:00.000Z'));
    expect(buscarChoqueEnIntervalo(intervalo, [lunesMatutina])).toBeNull();
  });

  it('ignora la misa del horario que se está celebrando', () => {
    const intervalo = intervaloCelebrada(new Date('2026-11-23T14:00:00.000Z'));
    expect(buscarChoqueEnIntervalo(intervalo, [lunesMatutina], 'h-lunes')).toBeNull();
  });

  it('la misa celebrada dura una hora salvo otra duración', () => {
    const inicio = new Date('2026-11-23T14:00:00.000Z');
    expect(intervaloCelebrada(inicio).fin.toISOString()).toBe('2026-11-23T15:00:00.000Z');
    expect(intervaloCelebrada(inicio, 45).fin.toISOString()).toBe('2026-11-23T14:45:00.000Z');
  });

  it('solo se registra una misa que ya empezó', () => {
    expect(puedeRegistrarCelebracion(new Date('2026-11-25T17:00:00Z'), AHORA)).toBe(true);
    expect(puedeRegistrarCelebracion(AHORA, AHORA)).toBe(true);
    expect(puedeRegistrarCelebracion(new Date('2026-11-25T19:00:00Z'), AHORA)).toBe(false);
  });
});
