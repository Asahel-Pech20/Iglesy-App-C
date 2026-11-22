// Periodo de un reporte de diezmo (RF-64–RF-68): fechas «yyyy-MM-dd» en la zona horaria de la
// iglesia convertidas a instantes. Funciones puras: el «ahora» llega por parámetro.

import { desfaseDeZona, partesLocales } from './zona';

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es una fecha real del calendario? («2026-02-30» no lo es.) */
export function esFechaValida(fecha: string): boolean {
  const m = FORMATO_FECHA.exec(fecha);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

const aTexto = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** El día siguiente de una fecha «yyyy-MM-dd». */
export function diaSiguiente(fecha: string): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  return aTexto(new Date(Date.UTC(anio, mes - 1, dia + 1)));
}

/** Instante UTC en que empieza el día `fecha` en la zona horaria (cubre los días de cambio de horario). */
export function inicioDelDia(fecha: string, zonaHoraria: string): Date {
  if (!esFechaValida(fecha)) throw new Error(`Fecha no válida: "${fecha}".`);
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, dia);
  // Se corrige dos veces: el desfase del día puede cambiar justo a la medianoche local
  const primero = medianocheUtc - desfaseDeZona(medianocheUtc, zonaHoraria);
  return new Date(medianocheUtc - desfaseDeZona(primero, zonaHoraria));
}

export interface PeriodoReporte {
  /** Primer y último día, «yyyy-MM-dd», en la hora local de la iglesia. */
  desde: string;
  hasta: string;
  /** Instante en que empieza el periodo. */
  inicio: Date;
  /** Instante en que termina (excluido): el comienzo del día siguiente al último. */
  finExcluido: Date;
}

export type ResultadoPeriodo =
  | { ok: true; periodo: PeriodoReporte }
  | { ok: false; motivo: 'FECHA_INVALIDA' | 'RANGO_INVERTIDO' };

/**
 * Periodo pedido. Sin `desde` ni `hasta`, el mes en curso de la iglesia (supuesto de diseño, no del
 * cliente). Con solo uno de los dos, ese mismo día.
 */
export function resolverPeriodo(
  desde: string | undefined,
  hasta: string | undefined,
  zonaHoraria: string,
  ahora: Date,
): ResultadoPeriodo {
  let primero: string;
  let ultimo: string;
  if (desde === undefined && hasta === undefined) {
    const p = partesLocales(ahora, zonaHoraria);
    const mes = String(p.mes).padStart(2, '0');
    primero = `${p.anio}-${mes}-01`;
    ultimo = aTexto(new Date(Date.UTC(p.anio, p.mes, 0))); // día 0 del mes siguiente = último de este
  } else {
    primero = (desde ?? hasta) as string;
    ultimo = (hasta ?? desde) as string;
  }
  if (!esFechaValida(primero) || !esFechaValida(ultimo))
    return { ok: false, motivo: 'FECHA_INVALIDA' };
  if (primero > ultimo) return { ok: false, motivo: 'RANGO_INVERTIDO' };
  return {
    ok: true,
    periodo: {
      desde: primero,
      hasta: ultimo,
      inicio: inicioDelDia(primero, zonaHoraria),
      finExcluido: inicioDelDia(diaSiguiente(ultimo), zonaHoraria),
    },
  };
}
