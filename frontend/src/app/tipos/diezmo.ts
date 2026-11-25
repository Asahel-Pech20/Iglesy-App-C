import type { QueryLista } from './comunes';

// Espejo de backend/src/modules/diezmo y misas (docs/ecclesia/api-diezmo-espacios.md).
// Los montos viajan como texto con 2 decimales ("1250.50"); nunca como número.

export interface Padre {
  id: string;
  nombre: string;
  /** «Pbro.», «Fr.»… (E3-05); no viene en la misa celebrada */
  titulo?: string | null;
}

/** Si la misa la dio un padre distinto del programado (E3-09, RF-50, RF-51) */
export interface SustitucionMisa {
  padreProgramado: Padre;
  motivo: string;
  hechaPor: { id: string; nombre: string };
  hechaEn: string;
}

/** Misa celebrada con su diezmo; la fecha y la hora ya vienen en la hora local de la iglesia (RN-31) */
export interface MisaCelebrada {
  id: string;
  /** Instante de inicio (ISO, UTC) */
  inicio: string;
  /** "yyyy-MM-dd" en la zona horaria de la iglesia */
  fechaLocal: string;
  /** "HH:mm" en la zona horaria de la iglesia */
  horaLocal: string;
  /** Quién la dio realmente (RN-29) */
  padre: Padre;
  /** Misa del horario de la que sale (E3-09); null en las registradas con instante y padre */
  horarioMisaId: string | null;
  sustitucion: SustitucionMisa | null;
  diezmo: { monto: string; actualizadoEn: string } | null;
}

export interface CorreccionDiezmo {
  id: string;
  montoAnterior: string;
  montoNuevo: string;
  hechaPor: { id: string; nombre: string };
  hechaEn: string;
}

/** GET /iglesias/:id/misas-celebradas/:misaId/diezmo */
export interface Diezmo {
  id: string;
  misaId: string;
  monto: string;
  capturadoPor: { id: string; nombre: string };
  createdAt: string;
  updatedAt: string;
  /** La más reciente primero */
  correcciones: CorreccionDiezmo[];
}

export interface QueryMisas extends QueryLista {
  desde?: string;
  hasta?: string;
}

export interface MisaExtrema {
  misaId: string;
  inicio: string;
  fechaLocal: string;
  horaLocal: string;
  monto: string;
}

/** GET /iglesias/:id/diezmo/resumen */
export interface ResumenDiezmo {
  desde: string;
  hasta: string;
  misas: number;
  total: string;
  /** null si no hay misas con diezmo en el periodo */
  promedio: string | null;
  conMas: MisaExtrema[];
  conMenos: MisaExtrema[];
}

export type AgrupacionDiezmo = 'dia' | 'semana' | 'mes' | 'horario' | 'padre';

export interface GrupoDiezmo {
  clave: string;
  etiqueta: string;
  misas: number;
  total: string;
}

/** GET /iglesias/:id/diezmo/agrupado */
export interface AgrupadoDiezmo {
  desde: string;
  hasta: string;
  por: AgrupacionDiezmo;
  grupos: GrupoDiezmo[];
}

export interface PeriodoDiezmo {
  desde?: string;
  hasta?: string;
}
