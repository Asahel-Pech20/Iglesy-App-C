// Espejo de backend/src/modules/servicios y misas para el público (E3-10, E3-12, E3-14, Genaro).
// Los montos viajan como texto con 2 decimales ("350.50"); las horas son las locales de la iglesia.

/** 0 = domingo … 6 = sábado; «HH:mm» en la hora local de la iglesia (RN-31) */
export interface HorarioSemanal {
  diaSemana: number;
  hora: string;
}

export type FormaCosto = 'MONTO' | 'GRATUITO' | 'DONATIVO';

/** Servicio en la ficha pública (RF-35) */
export interface ServicioPublico {
  nombre: string;
  formaCosto: FormaCosto;
  /** MONTO: el costo; DONATIVO: monto sugerido o null; GRATUITO: null */
  monto: string | null;
  requisitos: string | null;
  duracionMin: number | null;
  requiereCita: boolean;
  horarios: HorarioSemanal[];
}

export type TipoPlatica = 'PREBAUTISMAL' | 'PRIMERA_COMUNION' | 'CONFIRMACION' | 'PREMATRIMONIAL';

/** Plática en la ficha pública y en GET /public/iglesias/:id/platicas?tipo= (RF-38, RF-39) */
export interface PlaticaPublica {
  tipo: TipoPlatica;
  sesiones: number;
  /** "0.00" = gratuita */
  costo: string;
  /** Informativo (supuesto P-13) */
  cupo: number;
  lugar: string;
  imparte: string;
  horarios: HorarioSemanal[];
}

/** GET /public/platicas?tipo=&municipio= (RF-83): las pláticas del tipo en cada iglesia del municipio */
export interface PlaticasDeIglesia {
  iglesia: { id: string; nombre: string; tipo: string };
  platicas: PlaticaPublica[];
}

/** GET /iglesias/:id/servicios (panel de la iglesia, E3-11) */
export interface Servicio extends ServicioPublico {
  id: string;
}

/** Lo que se envía al crear o editar un servicio */
export type ServicioEntrada = ServicioPublico;

/** GET /iglesias/:id/platicas (panel de la iglesia, E3-13) */
export interface Platica extends PlaticaPublica {
  id: string;
  padre: { id: string; nombre: string; titulo: string | null } | null;
}

export interface PlaticaEntrada extends PlaticaPublica {
  padreId: string | null;
}

export type TipoMisa = 'DIARIA' | 'DOMINICAL' | 'ESPECIAL';

/** Misa del horario semanal en la ficha pública (RF-44) */
export interface MisaPublica {
  diaSemana: number;
  hora: string;
  tipo: TipoMisa;
  /** ESPANOL o una lengua indígena (RN-21) */
  idioma: string;
  /** null = una hora (RN-27) */
  duracionMin: number | null;
  /** Título y nombre del padre, p. ej. «Pbro. Andrés Ruiz» (supuesto P-19) */
  padre: string;
}
