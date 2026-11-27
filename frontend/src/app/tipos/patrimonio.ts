import type { QueryLista } from './comunes';
import type { ClaseEspacio } from './espacios';
import type { LugarInegi, TipoIglesia } from './iglesias';
import type { MisaPublica, PlaticaPublica, ServicioPublico } from './servicios';

// Espejo de backend/src/modules/patrimonio y consultas (E2-08, E2-10–E2-13, Nataly).

export type TipoObjeto =
  | 'IMAGEN'
  | 'RETABLO'
  | 'PINTURA'
  | 'MURAL'
  | 'ORGANO'
  | 'PIANO'
  | 'ORFEBRERIA'
  | 'MOBILIARIO_LITURGICO'
  | 'DOCUMENTO'
  | 'OTRO';

export type GrupoObjeto =
  'IMAGEN' | 'RETABLO_PINTURA_MURAL' | 'ORGANO_PIANO' | 'ORFEBRERIA_MOBILIARIO_DOCUMENTO' | 'OTRO';

export type EstadoObjeto = 'VIGENTE' | 'PERDIDO' | 'PRESTADO' | 'BAJA';

/** Objeto en el panel, con sus puntos de hoy (0 si no es vigente). */
export interface ObjetoPatrimonial {
  id: string;
  descripcion: string;
  tipo: TipoObjeto;
  grupo: GrupoObjeto;
  anio: number | null;
  siglo: number | null;
  epoca: string;
  antiguedad: number;
  material: string;
  estadoConservacion: string;
  ubicacionEnTemplo: string;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
  fechaEstado: string | null;
  motivoEstado: string | null;
  puntos: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrearObjeto {
  descripcion: string;
  tipo: TipoObjeto;
  anio: number | null;
  siglo: number | null;
  material: string;
  estadoConservacion: string;
  ubicacionEnTemplo: string;
  catalogadoInah: boolean;
}

export type EditarObjeto = Partial<CrearObjeto>;

export interface CambiarEstadoObjeto {
  estado: EstadoObjeto;
  fecha: string;
  motivo: string;
}

export interface QueryObjetos extends QueryLista {
  estado?: EstadoObjeto;
  tipo?: TipoObjeto;
}

export interface IndiceIglesia {
  indice: number;
  distincion: string | null;
  anioCalculo: number;
  objetosRegistrados: number;
  objetosVigentes: number;
}

export interface CriteriosIndice {
  rangosEdad: { desdeAnios: number; puntos: number }[];
  multiplicadores: Record<GrupoObjeto, number>;
  puntosInah: number;
  distinciones: { minimo: number; nombre: string }[];
}

/** Versión de los criterios; `id` null = los iniciales del caso. */
export interface VersionCriterios extends CriteriosIndice {
  id: string | null;
  vigenteDesde: string | null;
  creadoPor: { id: string; nombre: string } | null;
}

// ───────── Consultas públicas ─────────

/** Foto de una iglesia (por URL) con lo que su licencia pide mostrar; null si no tiene. */
export interface FotoApi {
  url: string;
  autor: string | null;
  licencia: string | null;
  licenciaUrl: string | null;
  enlace: string | null;
}

export interface IglesiaEnLista {
  id: string;
  nombre: string;
  tipo: TipoIglesia;
  direccion: string | null;
  capacidad: number | null;
  municipio: LugarInegi | null;
  localidad: LugarInegi | null;
  foto?: FotoApi | null;
  indice: number;
  distincion: string | null;
}

export interface QueryListaPublica extends QueryLista {
  estado: string;
  municipio?: string;
  localidad?: string;
  tipo?: TipoIglesia;
  capacidadMin?: number;
  capacidadMax?: number;
}

export interface ObjetoPublico {
  id: string;
  descripcion: string;
  tipo: TipoObjeto;
  anio: number | null;
  siglo: number | null;
  epoca: string;
  material: string;
  catalogadoInah: boolean;
}

export interface FichaIglesia {
  id: string;
  nombre: string;
  tipo: TipoIglesia;
  ubicacion: {
    direccion: string | null;
    estado: LugarInegi | null;
    municipio: LugarInegi | null;
    localidad: LugarInegi | null;
  };
  capacidad: number | null;
  anioConstruccion: number | null;
  contacto: { telefono: string | null; correo: string | null };
  coordenadas?: { latitud: string; longitud: string };
  foto?: FotoApi | null;
  indice: number;
  distincion: string | null;
  anioCalculo: number;
  objetos: ObjetoPublico[];
  /** E3-12, E3-14 y E3-10 (Genaro) */
  servicios: ServicioPublico[];
  platicas: PlaticaPublica[];
  misas: MisaPublica[];
  /** Lo que la iglesia ofrece, sin precios (E4-08 de Oscar). */
  tiposEspacio: { id: string; clase: ClaseEspacio }[];
}

export interface IglesiaReconocida {
  posicion: number;
  id: string;
  nombre: string;
  tipo: TipoIglesia;
  estado: LugarInegi | null;
  municipio: LugarInegi | null;
  localidad: LugarInegi | null;
  foto?: FotoApi | null;
  indice: number;
  distincion: string | null;
}

export interface Lugar {
  estado?: string;
  municipio?: string;
  localidad?: string;
}

export interface QueryReconocidas extends QueryLista, Lugar {}

export interface QueryBusqueda extends QueryLista, Lugar {
  tipoObjeto: TipoObjeto;
  antiguedadMin: number;
}

export interface ResultadoBusqueda extends Omit<IglesiaReconocida, 'posicion'> {
  objetos: { id: string; descripcion: string; epoca: string; antiguedad: number }[];
}
