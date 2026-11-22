export interface ConfiguracionIglesia {
  nombre: string;
  logoUrl: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  sitioWeb: string | null;
  /** ISO 4217, p. ej. "MXN" */
  moneda: string;
  /** IANA, p. ej. "America/Mexico_City" */
  zonaHoraria: string;
}

/**
 * PUT /configuracion (E1-06b): solo lo institucional. Nombre, dirección, ciudad, teléfono y correo
 * se editan en la ficha de la iglesia (PATCH /iglesias/:id) y el backend los rechaza aquí (400).
 */
export type EditarConfiguracion = Pick<ConfiguracionIglesia, 'sitioWeb' | 'moneda' | 'zonaHoraria'>;

export interface HorarioReunion {
  id: string;
  nombre: string;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
  /** "HH:mm" */
  horaInicio: string;
  horaFin: string | null;
  lugar: string | null;
  activo: boolean;
}

export type GuardarHorario = Omit<HorarioReunion, 'id'>;
