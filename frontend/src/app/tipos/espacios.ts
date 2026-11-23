import type { QueryLista } from './comunes';

// Espejo de backend/src/modules/espacios (docs/ecclesia/api-diezmo-espacios.md).
// El monto viaja como texto con 2 decimales ("12500.50"); nunca como número.

export type ClaseEspacio = 'CRIPTA' | 'NICHO' | 'COLUMBARIO' | 'OSARIO';

export type EstadoSolicitud =
  'RECIBIDA' | 'SIN_LUGAR' | 'COTIZADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | 'CANCELADA';

/** Fecha «aaaa-mm-dd» y hora «HH:mm» en la zona horaria de la iglesia */
export interface FechaLocal {
  fecha: string;
  hora: string;
}

// ───────── Panel ─────────

export interface TipoEspacio {
  id: string;
  clase: ClaseEspacio;
  /** false: la iglesia dejó de ofrecerlo (no se borra) */
  activo: boolean;
  /** false: se ofrece, pero no hay lugar por ahora */
  disponible: boolean;
}

export interface Cotizacion {
  monto: string;
  condiciones: string;
  emitidaEn: string;
  venceEn: string;
  emitidaLocal: FechaLocal;
  venceLocal: FechaLocal;
  respuesta: 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | null;
  /** Sin respuesta y todavía dentro de sus 15 días */
  vigente: boolean;
}

export interface SolicitudEspacio {
  id: string;
  folio: string;
  /** Estado efectivo: una cotizada cuya cotización venció ya viene como VENCIDA */
  estado: EstadoSolicitud;
  tipo: { id: string; clase: ClaseEspacio };
  contacto: { nombre: string; telefono: string | null; correo: string | null };
  comentarios: string | null;
  creadaEn: string;
  creadaLocal: FechaLocal;
  cotizacion: Cotizacion | null;
}

export interface QuerySolicitudes extends QueryLista {
  estado?: EstadoSolicitud;
}

export interface CotizarSolicitud {
  monto: string;
  condiciones: string;
}

// ───────── Público ─────────

export interface TiposPublicos {
  iglesia: { id: string; nombre: string };
  tipos: { id: string; clase: ClaseEspacio }[];
}

export interface CrearSolicitudPublica {
  tipoEspacioId: string;
  contacto: { nombre: string; telefono?: string; correo?: string };
  comentarios?: string;
}

/** La clave solo se devuelve aquí, una vez */
export interface SolicitudCreada {
  folio: string;
  clave: string;
  estado: 'RECIBIDA';
  iglesia: { nombre: string };
  aviso: string;
}

/** Lo que ve quien hizo la solicitud: nunca incluye la clave ni el contacto de la iglesia privada */
export interface SeguimientoSolicitud {
  folio: string;
  estado: EstadoSolicitud;
  tipo: { clase: ClaseEspacio };
  /** «Con quién se hace»: la iglesia y cómo comunicarse con ella */
  iglesia: { nombre: string; telefono: string | null; correo: string | null };
  creadaEn: string;
  creadaLocal: FechaLocal;
  cotizacion: Cotizacion | null;
}

export type RespuestaSolicitud = 'aceptar' | 'rechazar' | 'cancelar';
