// Reportes de diezmo (RF-64–RF-68, RN-44, RN-45). Funciones puras sobre las capturas que recibe;
// las sumas se hacen en centavos enteros. (En producción las sumas grandes irán en SQL; esto
// define el resultado esperado y cubre los casos pequeños.)

import { aCentavos, deCentavos } from './dinero';
import { SUPUESTOS_DIEZMO, type SupuestosDiezmo } from './supuestos';
import { type PartesLocales, partesLocales } from '../../../lib/dominio/zona';

/** Una captura de diezmo con lo que los reportes necesitan de su misa. */
export interface CapturaReporte {
  misaId: string;
  /** Instante de inicio de la misa. */
  inicio: Date;
  /** Monto en texto, p. ej. «1250.50». */
  monto: string;
  /** Padre que dio la misa realmente (P-23: quien la ofició, no el programado). */
  padreId: string;
}

export interface MisaConDiezmo {
  misaId: string;
  inicio: Date;
  monto: string;
}

export interface ResumenPeriodo {
  /** Misas con diezmo capturado en el periodo. */
  misas: number;
  total: string;
  /** Promedio por misa con captura, redondeado al centavo hacia arriba en la mitad; null si no hay misas. */
  promedio: string | null;
  conMas: MisaConDiezmo[];
  conMenos: MisaConDiezmo[];
}

const aMisa = (c: CapturaReporte): MisaConDiezmo => ({
  misaId: c.misaId,
  inicio: c.inicio,
  monto: deCentavos(aCentavos(c.monto)),
});

/** RF-64, RF-65: total, promedio por misa y misas con más y con menos diezmo. */
export function resumirPeriodo(
  capturas: readonly CapturaReporte[],
  supuestos: SupuestosDiezmo = SUPUESTOS_DIEZMO,
): ResumenPeriodo {
  const conCentavos = capturas.map((c) => ({ captura: c, centavos: aCentavos(c.monto) }));
  const total = conCentavos.reduce((suma, c) => suma + c.centavos, 0);
  const n = conCentavos.length;

  // Promedio al centavo, la mitad hacia arriba, con enteros: floor((2·total + n) / 2n)
  const promedio = n === 0 ? null : deCentavos(Math.floor((2 * total + n) / (2 * n)));

  // Empates: primero la misa más antigua; si coinciden también, por id (orden estable)
  const antes = (a: (typeof conCentavos)[number], b: (typeof conCentavos)[number]) =>
    a.captura.inicio.getTime() - b.captura.inicio.getTime() ||
    a.captura.misaId.localeCompare(b.captura.misaId);
  const masAMenos = [...conCentavos].sort((a, b) => b.centavos - a.centavos || antes(a, b));
  const menosAMas = [...conCentavos].sort((a, b) => a.centavos - b.centavos || antes(a, b));
  const cuantas = supuestos.cuantasMisasExtremas;

  return {
    misas: n,
    total: deCentavos(total),
    promedio,
    conMas: masAMenos.slice(0, cuantas).map((c) => aMisa(c.captura)),
    conMenos: menosAMas.slice(0, cuantas).map((c) => aMisa(c.captura)),
  };
}

export type CriterioAgrupacion = 'DIA' | 'SEMANA' | 'MES' | 'HORARIO' | 'PADRE';

export interface GrupoDiezmo {
  /** DIA «2026-11-08» · SEMANA: día en que empieza «2026-11-02» · MES «2026-11» · HORARIO «12:00» · PADRE: su id. */
  clave: string;
  misas: number;
  total: string;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const fechaIso = (anio: number, mes: number, dia: number) =>
  `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;

/** Día en que empieza la semana que contiene la fecha local indicada. */
function inicioDeSemana(p: PartesLocales, primerDia: 0 | 1): string {
  const fecha = new Date(Date.UTC(p.anio, p.mes - 1, p.dia));
  const retroceso = (fecha.getUTCDay() - primerDia + 7) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - retroceso);
  return fechaIso(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
}

function claveDe(
  c: CapturaReporte,
  criterio: CriterioAgrupacion,
  zonaHoraria: string,
  supuestos: SupuestosDiezmo,
): string {
  if (criterio === 'PADRE') return c.padreId;
  const p = partesLocales(c.inicio, zonaHoraria);
  switch (criterio) {
    case 'DIA':
      return fechaIso(p.anio, p.mes, p.dia);
    case 'SEMANA':
      return inicioDeSemana(p, supuestos.inicioDeSemana);
    case 'MES':
      return `${p.anio}-${dosDigitos(p.mes)}`;
    case 'HORARIO':
      return `${p.hora}:${p.minuto}`;
  }
}

/**
 * RF-66–RF-68: diezmo agrupado por día, semana, mes, horario de misa o padre. Día, semana, mes y
 * horario se calculan en la zona horaria de la iglesia. El horario es la hora local de inicio
 * (P-23). Los grupos salen ordenados por clave.
 */
export function agruparDiezmo(
  capturas: readonly CapturaReporte[],
  criterio: CriterioAgrupacion,
  zonaHoraria: string,
  supuestos: SupuestosDiezmo = SUPUESTOS_DIEZMO,
): GrupoDiezmo[] {
  const grupos = new Map<string, { misas: number; centavos: number }>();
  for (const c of capturas) {
    const clave = claveDe(c, criterio, zonaHoraria, supuestos);
    const actual = grupos.get(clave) ?? { misas: 0, centavos: 0 };
    grupos.set(clave, { misas: actual.misas + 1, centavos: actual.centavos + aCentavos(c.monto) });
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, g]) => ({ clave, misas: g.misas, total: deCentavos(g.centavos) }));
}
