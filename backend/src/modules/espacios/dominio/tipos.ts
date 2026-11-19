// Tipos del dominio de la solicitud de espacio (sección 7 de docs/requerimientos.md).
// Solo tipos: sin lógica, sin BD, sin reloj.

/** Estados de una solicitud. Los nombres son una propuesta; el caso no los fija (sección 7). */
export type EstadoSolicitud =
  'RECIBIDA' | 'SIN_LUGAR' | 'COTIZADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | 'CANCELADA';

/** Quién provoca un cambio de estado. El sistema solo provoca el vencimiento. */
export type Actor = 'SOLICITANTE' | 'ADMINISTRADOR' | 'SISTEMA';

export type Accion =
  'COTIZAR' | 'MARCAR_SIN_LUGAR' | 'ACEPTAR' | 'RECHAZAR' | 'VENCER' | 'CANCELAR';

/** Lo mínimo que el dominio necesita saber de una solicitud. */
export interface SolicitudDominio {
  estado: EstadoSolicitud;
  /** La cotización vigente de la solicitud; null si todavía no se cotiza. */
  cotizacion: { emitidaEn: Date } | null;
}

export type MotivoRechazo =
  /** El actor no tiene permitido provocar esa acción (el service lo traduce a 403). */
  | 'ACTOR_NO_AUTORIZADO'
  /** La acción no es válida desde el estado actual (el service lo traduce a 422). */
  | 'TRANSICION_NO_PERMITIDA'
  /** Se intentó aceptar o rechazar una cotización que ya venció. */
  | 'COTIZACION_VENCIDA'
  /** Se intentó vencer una cotización que todavía está vigente. */
  | 'COTIZACION_VIGENTE';

export type ResultadoTransicion =
  { ok: true; estadoNuevo: EstadoSolicitud } | { ok: false; motivo: MotivoRechazo };
