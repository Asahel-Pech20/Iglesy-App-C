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
  /** E3-25: ese día no hubo misa u otra hora */
  excepcion: ExcepcionDeMisa | null;
}

/** GET /padres/:id/agenda?semana= */
export interface AgendaPadre {
  padre: { id: string; nombre: string; titulo: string | null; activo: boolean };
  semana: { desde: string; hasta: string };
  misas: MisaAgenda[];
}

/** RF-84: estado de cada misa de la semana armada desde el horario */
export type EstadoMisaSemana = 'REGISTRADA' | 'PENDIENTE' | 'FUTURA' | 'SIN_MISA';

export interface MisaDeSemana {
  horarioId: string;
  diaSemana: number;
  fecha: string;
  hora: string;
  inicio: string;
  tipo: TipoMisa;
  idioma: IdiomaMisa;
  duracionMin: number | null;
  padreProgramado: { id: string; nombre: string; titulo: string | null };
  estado: EstadoMisaSemana;
  /** E3-25: ese día no hubo misa u otra hora (`hora` ya es la nueva) */
  excepcion: ExcepcionDeMisa | null;
  misaCelebrada: {
    id: string;
    padre: { id: string; nombre: string };
    conSustitucion: boolean;
  } | null;
}

/** GET /iglesias/:id/semana-misas?semana= */
export interface SemanaMisas {
  semana: { desde: string; hasta: string };
  misas: MisaDeSemana[];
}

/** POST /iglesias/:id/misas-celebradas/semana */
export interface ResultadoArmarSemana {
  semana: { desde: string; hasta: string };
  creadas: number;
  yaRegistradas: number;
  futuras: number;
  /** E3-25: días sin misa, que no se registran */
  sinMisa: number;
  omitidas: { fecha: string; hora: string; motivo: string }[];
}

/** POST /iglesias/:id/misas-celebradas desde el horario (E3-09) */
export interface MisaDeHorarioEntrada {
  horarioMisaId: string;
  fecha: string;
  /** Solo si la dio otro padre (sustitución) */
  padreId?: string;
  motivo?: string;
}

// ───────── Días inhábiles (E3-25, supuesto P-33) ─────────

export type TipoExcepcionMisa = 'SIN_MISA' | 'OTRA_HORA';

/** La excepción tal como viene en la semana y en la agenda */
export interface ExcepcionDeMisa {
  tipo: TipoExcepcionMisa;
  horaNueva: string | null;
  motivo: string;
  /** Hora normal del horario */
  horaHorario: string;
}

/** Una excepción del panel: GET /iglesias/:id/excepciones-misa */
export interface ExcepcionMisa {
  id: string;
  fecha: string;
  tipo: TipoExcepcionMisa;
  horaNueva: string | null;
  motivo: string;
  registradoPor: { id: string; nombre: string };
  registradaEn: string;
  misa: {
    horarioId: string;
    diaSemana: number;
    hora: string;
    tipo: TipoMisa;
    padre: { id: string; nombre: string; titulo: string | null };
  };
}

export interface ExcepcionesMisa {
  desde: string;
  hasta: string;
  excepciones: ExcepcionMisa[];
}

/** POST /iglesias/:id/excepciones-misa */
export interface ExcepcionMisaEntrada {
  horarioMisaId: string;
  fecha: string;
  tipo: TipoExcepcionMisa;
  horaNueva?: string;
  motivo: string;
}

/** Para el público (ficha): GET /public/iglesias/:id/excepciones-misa */
export interface ExcepcionPublica {
  fecha: string;
  diaSemana: number;
  hora: string;
  tipoMisa: TipoMisa;
  tipo: TipoExcepcionMisa;
  horaNueva: string | null;
  motivo: string;
  padre: string;
}
