// Supuestos de la solicitud de espacio. ÚNICO lugar donde viven.
//
// ⚠ Estos valores NO son reglas del cliente. P-26 y P-27 de docs/requerimientos.md siguen sin
// respuesta; mientras tanto el dominio asume lo de abajo. Cuando el cliente responda, se cambia
// solo este archivo (y se ajustan las pruebas que lo cubren). Ninguna otra parte del dominio
// repite estos valores.

import type { EstadoSolicitud } from './tipos';

export interface Supuestos {
  /** RN-51: «Cada cotización vale 15 días». Este dato sí viene del caso. */
  vigenciaDias: number;
  /**
   * SUPUESTO (P-26, «¿los 15 días son naturales y cuentan desde que se emite?»):
   * cada día de vigencia dura 24 horas exactas contadas desde el instante en que se emite la
   * cotización, sin importar zona horaria ni cambios de horario.
   */
  msPorDiaDeVigencia: number;
  /**
   * SUPUESTO (P-26): en el instante exacto en que se cumplen los 15 días la cotización ya está
   * vencida (CA-29: «emitida hace 15 días» queda «Vencida»). Con `false` seguiría vigente hasta
   * pasar ese instante.
   */
  vencidaEnElInstanteLimite: boolean;
  /**
   * SUPUESTO (P-26 y P-27): el administrador solo cotiza una solicitud recién recibida. Tras
   * rechazo o vencimiento no se cotiza de nuevo, y «Sin lugar» cierra la solicitud. Para permitir
   * una nueva cotización, agregar aquí 'SIN_LUGAR', 'RECHAZADA' o 'VENCIDA'.
   */
  estadosDesdeLosQueSeCotiza: readonly EstadoSolicitud[];
  /**
   * SUPUESTO (P-26 y P-27): la persona cancela mientras la solicitud está abierta (recibida o con
   * cotización vigente). Una aceptada no se cancela (RN-52); los demás estados son finales.
   */
  estadosCancelables: readonly EstadoSolicitud[];
}

export const SUPUESTOS: Supuestos = {
  vigenciaDias: 15,
  msPorDiaDeVigencia: 24 * 60 * 60 * 1000,
  vencidaEnElInstanteLimite: true,
  estadosDesdeLosQueSeCotiza: ['RECIBIDA'],
  estadosCancelables: ['RECIBIDA', 'COTIZADA'],
};
