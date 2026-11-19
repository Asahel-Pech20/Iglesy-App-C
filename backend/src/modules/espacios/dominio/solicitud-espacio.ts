// Transiciones de la solicitud de espacio (sección 7, RF-76–RF-80, RN-50–RN-52).
// Función pura: no consulta BD ni reloj. El service recibe el resultado y lo traduce a errores HTTP.

import { SUPUESTOS, type Supuestos } from './supuestos';
import type {
  Accion,
  Actor,
  EstadoSolicitud,
  ResultadoTransicion,
  SolicitudDominio,
} from './tipos';
import { cotizacionVencida } from './vigencia-cotizacion';

/** Estado con el que nace una solicitud cuando el solicitante la envía (RF-72). */
export const ESTADO_INICIAL: EstadoSolicitud = 'RECIBIDA';

/** Quién provoca cada acción (sección 7). */
export const QUIEN_PROVOCA: Readonly<Record<Accion, Actor>> = {
  COTIZAR: 'ADMINISTRADOR',
  MARCAR_SIN_LUGAR: 'ADMINISTRADOR',
  ACEPTAR: 'SOLICITANTE',
  RECHAZAR: 'SOLICITANTE',
  CANCELAR: 'SOLICITANTE',
  VENCER: 'SISTEMA',
};

/** Estado al que lleva cada acción. */
const ESTADO_RESULTANTE: Readonly<Record<Accion, EstadoSolicitud>> = {
  COTIZAR: 'COTIZADA',
  MARCAR_SIN_LUGAR: 'SIN_LUGAR',
  ACEPTAR: 'ACEPTADA',
  RECHAZAR: 'RECHAZADA',
  CANCELAR: 'CANCELADA',
  VENCER: 'VENCIDA',
};

/** Estados desde los que cada acción es válida. Lo que depende de P-26/P-27 sale de `supuestos`. */
function estadosOrigen(accion: Accion, supuestos: Supuestos): readonly EstadoSolicitud[] {
  switch (accion) {
    case 'COTIZAR':
      return supuestos.estadosDesdeLosQueSeCotiza;
    case 'CANCELAR':
      return supuestos.estadosCancelables;
    case 'MARCAR_SIN_LUGAR':
      return ['RECIBIDA'];
    case 'ACEPTAR':
    case 'RECHAZAR':
    case 'VENCER':
      return ['COTIZADA'];
  }
}

export function puedeProvocar(accion: Accion, actor: Actor): boolean {
  return QUIEN_PROVOCA[accion] === actor;
}

/**
 * Estado real de la solicitud en `ahora`: una cotizada cuya cotización ya venció cuenta como
 * VENCIDA aunque nadie haya guardado ese cambio todavía (así lo ven la persona, el panel y los reportes).
 */
export function estadoEfectivo(
  solicitud: SolicitudDominio,
  ahora: Date,
  supuestos: Supuestos = SUPUESTOS,
): EstadoSolicitud {
  if (solicitud.estado !== 'COTIZADA') return solicitud.estado;
  if (!solicitud.cotizacion) throw new Error('Una solicitud cotizada necesita su cotización.');
  return cotizacionVencida(solicitud.cotizacion.emitidaEn, ahora, supuestos)
    ? 'VENCIDA'
    : 'COTIZADA';
}

/** ¿Puede `actor` provocar `accion` sobre la solicitud en `ahora`? Si sí, devuelve el estado nuevo. */
export function evaluarTransicion(
  solicitud: SolicitudDominio,
  accion: Accion,
  actor: Actor,
  ahora: Date,
  supuestos: Supuestos = SUPUESTOS,
): ResultadoTransicion {
  if (!puedeProvocar(accion, actor)) return { ok: false, motivo: 'ACTOR_NO_AUTORIZADO' };

  const efectivo = estadoEfectivo(solicitud, ahora, supuestos);

  if (accion === 'VENCER') {
    // Solo el vencimiento de una cotizada guardada como tal; antes de tiempo no se puede.
    if (solicitud.estado !== 'COTIZADA') return { ok: false, motivo: 'TRANSICION_NO_PERMITIDA' };
    return efectivo === 'VENCIDA'
      ? { ok: true, estadoNuevo: ESTADO_RESULTANTE.VENCER }
      : { ok: false, motivo: 'COTIZACION_VIGENTE' };
  }

  // CA-29: con la cotización vencida ya no se puede aceptar ni rechazar el precio.
  if ((accion === 'ACEPTAR' || accion === 'RECHAZAR') && efectivo === 'VENCIDA') {
    return { ok: false, motivo: 'COTIZACION_VENCIDA' };
  }

  if (!estadosOrigen(accion, supuestos).includes(efectivo)) {
    return { ok: false, motivo: 'TRANSICION_NO_PERMITIDA' };
  }
  return { ok: true, estadoNuevo: ESTADO_RESULTANTE[accion] };
}
