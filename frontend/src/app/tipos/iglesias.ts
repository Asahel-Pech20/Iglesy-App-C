import type { QueryLista } from './comunes';

// Espejo de backend/src/modules/iglesias (base de Oscar ampliada en E2-06, Nataly).

export type TipoIglesia =
  'CATEDRAL' | 'BASILICA' | 'PARROQUIA' | 'TEMPLO' | 'CAPILLA' | 'SANTUARIO';

/** Estado, municipio o localidad del catálogo del INEGI. */
export interface LugarInegi {
  clave: string;
  nombre: string;
}

export interface Iglesia {
  id: string;
  nombre: string;
  tipo: TipoIglesia;
  zonaHoraria: string;
  activa: boolean;
  direccion?: string | null;
  capacidad?: number | null;
  anioConstruccion?: number | null;
  telefono?: string | null;
  correo?: string | null;
  latitud?: string | null;
  longitud?: string | null;
  fechaCierre?: string | null;
  motivoCierre?: string | null;
  estado?: LugarInegi | null;
  municipio?: LugarInegi | null;
  localidad?: LugarInegi | null;
  /** Foto por URL con su autor y licencia (null si no tiene) */
  foto?: {
    url: string;
    autor: string | null;
    licencia: string | null;
    licenciaUrl: string | null;
    enlace: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Datos de la ficha que se capturan (RF-07). Vacío = null. */
export interface DatosIglesia {
  direccion?: string | null;
  estado?: string | null;
  municipio?: string | null;
  localidad?: string | null;
  capacidad?: number | null;
  anioConstruccion?: number | null;
  telefono?: string | null;
  correo?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface CrearIglesia extends DatosIglesia {
  nombre: string;
  tipo: TipoIglesia;
  zonaHoraria?: string;
}

export type EditarIglesia = Partial<CrearIglesia>;

export interface CerrarIglesia {
  fecha: string;
  motivo: string;
}

export type SituacionIglesia = 'activas' | 'cerradas' | 'todas';

export interface QueryIglesias extends QueryLista {
  estado?: string;
  municipio?: string;
  tipo?: TipoIglesia;
  situacion?: SituacionIglesia;
}
