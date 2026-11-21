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
   * vencida (el caso no lo fija; CA-29 solo prueba 16 días). Con `false` seguiría vigente hasta
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

/** Supuestos del acceso sin cuenta (folio y clave). Ninguno es una regla del cliente: P-25 sigue abierta. */
export interface SupuestosAcceso {
  /**
   * SUPUESTO (P-25): prefijo genérico del folio. «CR» sugeriría cripta y la solicitud puede ser de
   * un nicho, un columbario o un osario. El consecutivo es nacional (no se repite entre iglesias).
   */
  prefijoFolio: string;
  /**
   * SUPUESTO (P-25): la clave es corta para que una persona la anote o la dicte por teléfono:
   * 10 caracteres de un alfabeto sin ambiguos (sin 0/O ni 1/I/L) son 31^10, unos 49.5 bits.
   * Se guarda solo con SHA-256 y se compara en tiempo constante. Con el bloqueo por folio y el
   * límite de peticiones por IP alcanza para que no se adivine en línea; no es una contraseña.
   */
  longitudClave: number;
  alfabetoClave: string;
  /**
   * SUPUESTO (P-25): tras este número de claves incorrectas seguidas, el folio se bloquea.
   * LIMITACIÓN ACEPTADA POR AHORA: el bloqueo es por folio, así que un tercero que conozca un folio
   * ajeno podría bloquearlo durante `minutosDeBloqueo` minutos haciendo consultas con claves falsas.
   */
  intentosAntesDeBloquear: number;
  minutosDeBloqueo: number;
  /**
   * SUPUESTO (P-25): la persona debe dejar un teléfono o un correo (al menos uno) para que la
   * iglesia pueda ponerse en contacto; el aviso de la cotización es solo al consultar con folio y
   * clave, sin correo. Una persona puede hacer varias solicitudes, también a varias iglesias.
   */
  contactoMinimo: 'TELEFONO_O_CORREO';
}

export const SUPUESTOS_ACCESO: SupuestosAcceso = {
  prefijoFolio: 'ESP',
  longitudClave: 10,
  alfabetoClave: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  intentosAntesDeBloquear: 5,
  minutosDeBloqueo: 15,
  contactoMinimo: 'TELEFONO_O_CORREO',
};
