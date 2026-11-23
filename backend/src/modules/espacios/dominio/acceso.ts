// Acceso sin cuenta a una solicitud de espacio: folio, clave y bloqueo por intentos fallidos
// (RN-49, RNF-14). Funciones puras: la aleatoriedad y el reloj llegan por parámetro.

import { SUPUESTOS_ACCESO, type SupuestosAcceso } from './supuestos';

/** Folio legible, p. ej. ESP-2026-000123. */
export function formatearFolio(
  anio: number,
  consecutivo: number,
  supuestos: SupuestosAcceso = SUPUESTOS_ACCESO,
): string {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 9999) {
    throw new Error('El año del folio no es válido.');
  }
  if (!Number.isInteger(consecutivo) || consecutivo < 1) {
    throw new Error('El consecutivo del folio debe ser un entero positivo.');
  }
  return `${supuestos.prefijoFolio}-${anio}-${String(consecutivo).padStart(6, '0')}`;
}

/**
 * Clave a partir de bytes aleatorios. Descarta los bytes que sesgarían el reparto (un módulo sobre
 * 256 no es uniforme). Devuelve null si los bytes no alcanzan: quien llama pide más y reintenta.
 */
export function claveDesdeBytes(
  bytes: Uint8Array,
  supuestos: SupuestosAcceso = SUPUESTOS_ACCESO,
): string | null {
  const n = supuestos.alfabetoClave.length;
  const limite = 256 - (256 % n);
  let clave = '';
  for (const b of bytes) {
    if (b >= limite) continue;
    clave += supuestos.alfabetoClave[b % n];
    if (clave.length === supuestos.longitudClave) return clave;
  }
  return null;
}

/** La clave tal como se muestra para anotarla: dos grupos de cinco, «ABCDE-FGHJK». */
export function mostrarClave(clave: string): string {
  const mitad = Math.ceil(clave.length / 2);
  return `${clave.slice(0, mitad)}-${clave.slice(mitad)}`;
}

/** Lo que escribe la persona (minúsculas, espacios o guion) se lleva a la forma guardada. */
export function normalizarClave(texto: string): string {
  return texto.replace(/[\s-]/g, '').toUpperCase();
}

/** Folios en la forma guardada: mayúsculas y sin espacios alrededor. */
export function normalizarFolio(texto: string): string {
  return texto.trim().toUpperCase();
}

export interface IntentosDeSolicitud {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

/** ¿Está bloqueado el folio en `ahora`? Si sí, cuántos minutos faltan (redondeado hacia arriba). */
export function evaluarBloqueo(
  s: IntentosDeSolicitud,
  ahora: Date,
): { bloqueado: false } | { bloqueado: true; minutosRestantes: number } {
  if (s.bloqueadoHasta && s.bloqueadoHasta.getTime() > ahora.getTime()) {
    return {
      bloqueado: true,
      minutosRestantes: Math.ceil((s.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000),
    };
  }
  return { bloqueado: false };
}

/** Intentos que cuentan hoy: un bloqueo ya cumplido borra los anteriores. */
export function intentosVigentes(s: IntentosDeSolicitud, ahora: Date): number {
  return s.bloqueadoHasta && s.bloqueadoHasta.getTime() <= ahora.getTime() ? 0 : s.intentosFallidos;
}

/** Contadores después de una clave incorrecta; al llegar al límite fija el bloqueo. */
export function trasIntentoFallido(
  s: IntentosDeSolicitud,
  ahora: Date,
  supuestos: SupuestosAcceso = SUPUESTOS_ACCESO,
): IntentosDeSolicitud {
  const intentosFallidos = intentosVigentes(s, ahora) + 1;
  const bloquea = intentosFallidos >= supuestos.intentosAntesDeBloquear;
  return {
    intentosFallidos,
    bloqueadoHasta: bloquea
      ? new Date(ahora.getTime() + supuestos.minutosDeBloqueo * 60_000)
      : null,
  };
}
