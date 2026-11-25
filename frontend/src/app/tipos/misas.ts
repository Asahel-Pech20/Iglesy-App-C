// Espejo de backend/src/modules/misas (E3-06 a E3-09, Genaro): padres, horario semanal y agenda.
// Las horas son las locales de cada iglesia (RN-31); 0 = domingo … 6 = sábado.
import type { Padre } from './diezmo';
import type { TipoMisa } from './servicios';

export type IdiomaMisa =
  | 'ESPANOL'
  | 'NAHUATL'
  | 'MAYA'
  | 'TSELTAL'
  | 'TSOTSIL'
  | 'MIXTECO'
  | 'ZAPOTECO'
  | 'OTOMI'
  | 'TOTONACO'
  | 'MAZATECO'
  | 'CHOL'
  | 'OTRO';

/** GET /iglesias/:id/horario-misas (RF-42, RF-43) */
export interface HorarioMisa {
  id: string;
  diaSemana: number;
  hora: string;
  tipo: TipoMisa;
  idioma: IdiomaMisa;
  /** null = una hora (RN-27) */
  duracionMin: number | null;
  activo: boolean;
  padre: Padre;
}

export interface HorarioMisaEntrada {
  diaSemana: number;
  hora: string;
  tipo: TipoMisa;
  idioma: IdiomaMisa;
  duracionMin: number | null;
  padreId: string;
}

/** GET /padres (Coordinación): el padre con las iglesias donde celebra */
export interface PadreNacional {
  id: string;
  nombre: string;
  titulo: string | null;
  activo: boolean;
  iglesias: { id: string; nombre: string }[];
}

/** Una misa de la agenda semanal del padre (RF-47) */
export interface MisaAgenda {
  horarioId: string;
  iglesia: { id: string; nombre: string };
  diaSemana: number;
  /** «yyyy-MM-dd» en la hora local de la iglesia */
  fecha: string;
  hora: string;
  zonaHoraria: string;
  duracionMin: number | null;
  tipo: TipoMisa;
  idioma: IdiomaMisa;
  inicio: string;
  fin: string;
}

/** GET /padres/:id/agenda?semana= */
export interface AgendaPadre {
  padre: { id: string; nombre: string; titulo: string | null; activo: boolean };
  semana: { desde: string; hasta: string };
  misas: MisaAgenda[];
}

/** POST /iglesias/:id/misas-celebradas desde el horario (E3-09) */
export interface MisaDeHorarioEntrada {
  horarioMisaId: string;
  fecha: string;
  /** Solo si la dio otro padre (sustitución) */
  padreId?: string;
  motivo?: string;
}
