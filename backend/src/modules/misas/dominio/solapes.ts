// Choques de horario de un padre (RN-26, RN-27, RN-31; supuesto P-15). Funciones puras: el «ahora»
// llega por parámetro y la hora local se convierte con la zona de cada iglesia.
//
// Supuesto P-15 (pendiente de confirmar con el cliente):
// - Dos misas chocan si sus intervalos [inicio, inicio + duración) se empalman en el mismo momento
//   real (UTC), aunque las iglesias estén en zonas horarias distintas.
// - Misas seguidas (una termina justo cuando empieza la otra) no chocan; no se exige traslado.

import { fechaYHoraLocal, instanteLocal } from '../../../lib/dominio/zona';

/** RN-27: una misa dura una hora salvo que se indique otra duración. */
export const DURACION_POR_DEFECTO_MIN = 60;
/** Límite razonable de una misa (12 h); evita capturas absurdas como 6000 minutos. */
export const DURACION_MAXIMA_MIN = 12 * 60;

/** 0 = domingo … 6 = sábado, igual que `HorarioReunion.diaSemana`. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Una misa del horario semanal tal como la necesita la detección de choques. */
export interface MisaProgramada {
  /** Id de la misa del horario; se omite al crear una nueva. */
  id?: string;
  iglesiaId: string;
  diaSemana: DiaSemana;
  /** Hora local de la iglesia, «HH:mm». */
  hora: string;
  /** Minutos; null o undefined = duración por defecto (RN-27). */
  duracionMin?: number | null;
  /** Zona IANA de la iglesia (RN-31). */
  zonaHoraria: string;
}

export interface Intervalo {
  inicio: Date;
  fin: Date;
}

export interface Choque<T extends MisaProgramada = MisaProgramada> {
  /** La misa ya programada con la que choca (para decirle al administrador cuál es, RF-45). */
  misa: T;
  /** Intervalo de la misa existente en la semana donde se detectó el choque. */
  intervalo: Intervalo;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Duración efectiva en minutos (RN-27). Lanza si no es un entero entre 1 y 720. */
export function duracionEfectiva(duracionMin?: number | null): number {
  if (duracionMin === null || duracionMin === undefined) return DURACION_POR_DEFECTO_MIN;
  if (!Number.isInteger(duracionMin) || duracionMin < 1 || duracionMin > DURACION_MAXIMA_MIN) {
    throw new Error(`La duración debe ser un número entero de 1 a ${DURACION_MAXIMA_MIN} minutos.`);
  }
  return duracionMin;
}

/** Fecha «yyyy-MM-dd» desplazada `dias` días (calendario puro, sin zona horaria). */
export function sumarDias(fecha: string, dias: number): string {
  const f = FECHA.exec(fecha);
  if (!f) throw new Error(`Fecha no válida: ${fecha}`);
  const ms = Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3])) + dias * MS_DIA;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha «yyyy-MM-dd». */
export function diaDeLaSemana(fecha: string): DiaSemana {
  const f = FECHA.exec(fecha);
  if (!f) throw new Error(`Fecha no válida: ${fecha}`);
  return new Date(Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]))).getUTCDay() as DiaSemana;
}

/** Domingo con que empieza la semana de una fecha «yyyy-MM-dd». */
export function domingoDeLaSemana(fecha: string): string {
  return sumarDias(fecha, -diaDeLaSemana(fecha));
}

/**
 * Intervalo real (UTC) de una misa del horario en la semana que empieza el domingo `domingo`.
 * Devuelve null si esa hora no existe ese día en la zona de la iglesia (cambio de horario).
 */
export function intervaloEnSemana(misa: MisaProgramada, domingo: string): Intervalo | null {
  const fecha = sumarDias(domingo, misa.diaSemana);
  const inicio = instanteLocal(fecha, misa.hora, misa.zonaHoraria);
  if (!inicio) return null;
  const fin = new Date(inicio.getTime() + duracionEfectiva(misa.duracionMin) * 60_000);
  return { inicio, fin };
}

/** Intervalo de una misa celebrada: su inicio real y su duración (RN-27). */
export function intervaloCelebrada(inicio: Date, duracionMin?: number | null): Intervalo {
  return { inicio, fin: new Date(inicio.getTime() + duracionEfectiva(duracionMin) * 60_000) };
}

/** ¿Se empalman? Intervalos semiabiertos: si una termina cuando empieza la otra, no (P-15). */
export function seEmpalman(a: Intervalo, b: Intervalo): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}

/**
 * Semanas (domingos) en que se comparan los horarios. Además de la semana de `ahora`, se revisan
 * una de enero y una de julio del mismo año: si alguna iglesia cambia de horario en verano
 * (p. ej. la frontera norte), dos misas pueden chocar solo en una de las dos temporadas.
 */
export function semanasDeReferencia(ahora: Date): string[] {
  const anio = ahora.getUTCFullYear();
  const hoy = ahora.toISOString().slice(0, 10);
  const semanas = [
    domingoDeLaSemana(hoy),
    domingoDeLaSemana(`${anio}-01-15`),
    domingoDeLaSemana(`${anio}-07-15`),
  ];
  return [...new Set(semanas)];
}

/**
 * Busca la primera misa del horario del mismo padre que choca con `nueva` (RN-26, RF-45).
 * `existentes` son las misas del padre en todas sus iglesias; la que tiene el mismo id que `nueva`
 * (cuando se está editando) se ignora. Se revisa cada semana de referencia y la anterior, para
 * detectar choques que cruzan la medianoche del sábado al domingo.
 */
export function buscarChoque<T extends MisaProgramada>(
  nueva: MisaProgramada,
  existentes: readonly T[],
  semanas: readonly string[],
): Choque<T> | null {
  for (const domingo of semanas) {
    const propio = intervaloEnSemana(nueva, domingo);
    if (!propio) continue;
    for (const otra of existentes) {
      if (nueva.id !== undefined && otra.id === nueva.id) continue;
      for (const semana of [sumarDias(domingo, -7), domingo, sumarDias(domingo, 7)]) {
        const ajeno = intervaloEnSemana(otra, semana);
        if (ajeno && seEmpalman(propio, ajeno)) return { misa: otra, intervalo: ajeno };
      }
    }
  }
  return null;
}

/**
 * Busca una misa del horario del padre que se empalme con un intervalo concreto, por ejemplo el de
 * una sustitución (supuesto P-17: el sustituto no puede tener otra misa a esa hora).
 * `ignorarId` excluye la misa del horario que se está celebrando.
 */
export function buscarChoqueEnIntervalo<T extends MisaProgramada>(
  intervalo: Intervalo,
  existentes: readonly T[],
  ignorarId?: string,
): Choque<T> | null {
  const fecha = intervalo.inicio.toISOString().slice(0, 10);
  const domingo = domingoDeLaSemana(fecha);
  for (const otra of existentes) {
    if (ignorarId !== undefined && otra.id === ignorarId) continue;
    for (const semana of [sumarDias(domingo, -7), domingo, sumarDias(domingo, 7)]) {
      const ajeno = intervaloEnSemana(otra, semana);
      if (ajeno && seEmpalman(intervalo, ajeno)) return { misa: otra, intervalo: ajeno };
    }
  }
  return null;
}

/** Supuesto P-17: una misa celebrada solo se registra cuando ya empezó, no a futuro. */
export function puedeRegistrarCelebracion(inicio: Date, ahora: Date): boolean {
  return inicio.getTime() <= ahora.getTime();
}

/** Día y hora locales de un intervalo, para el mensaje de choque («domingo 10:00»). */
export function describirEnZona(
  intervalo: Intervalo,
  zonaHoraria: string,
): { diaSemana: DiaSemana; fecha: string; hora: string } {
  const { fecha, hora } = fechaYHoraLocal(intervalo.inicio, zonaHoraria);
  return { diaSemana: diaDeLaSemana(fecha), fecha, hora };
}
