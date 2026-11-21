// Vigencia de la cotización (RN-51, RF-79). Funciones puras: el «ahora» siempre llega por parámetro.

import { SUPUESTOS, type Supuestos } from './supuestos';

function exigirFecha(fecha: Date, nombre: string): void {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    throw new Error(`${nombre} no es una fecha válida.`);
  }
}

/** Instante en que se cumplen los días de vigencia de una cotización emitida en `emitidaEn`. */
export function fechaVencimiento(emitidaEn: Date, supuestos: Supuestos = SUPUESTOS): Date {
  exigirFecha(emitidaEn, 'La fecha de emisión');
  return new Date(emitidaEn.getTime() + supuestos.vigenciaDias * supuestos.msPorDiaDeVigencia);
}

/** ¿Ya venció la cotización en el instante `ahora`? Una emisión futura nunca está vencida. */
export function cotizacionVencida(
  emitidaEn: Date,
  ahora: Date,
  supuestos: Supuestos = SUPUESTOS,
): boolean {
  exigirFecha(ahora, 'El instante actual');
  const limite = fechaVencimiento(emitidaEn, supuestos).getTime();
  return supuestos.vencidaEnElInstanteLimite ? ahora.getTime() >= limite : ahora.getTime() > limite;
}
