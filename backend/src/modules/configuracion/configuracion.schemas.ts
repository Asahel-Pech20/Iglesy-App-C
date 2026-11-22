import { z } from 'zod';

// Listas permitidas (B1-15). Copia exacta en frontend/src/features/configuracion/catalogos.ts.
export const MONEDAS = ['MXN', 'USD', 'EUR', 'GTQ', 'HNL', 'COP', 'PEN', 'CLP', 'ARS'] as const;
export const ZONAS_HORARIAS = [
  'America/Mexico_City',
  'America/Merida',
  'America/Cancun',
  'America/Monterrey',
  'America/Chihuahua',
  'America/Hermosillo',
  'America/Tijuana',
  'America/Guatemala',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
] as const;

/** Texto opcional: "" o null se guardan como null. */
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/**
 * PUT /configuracion (E1-06b): solo lo institucional de la iglesia del usuario. Es estricto: nombre,
 * dirección, ciudad, teléfono o correo responden 400, porque se editan en la ficha de la iglesia
 * (PATCH /iglesias/:id, módulo de Nataly) con sus reglas (nombre único por municipio, INEGI).
 */
export const esquemaConfiguracion = z.strictObject({
  sitioWeb: z
    .url('URL no válida (incluye https://).')
    .or(z.literal(''))
    .nullish()
    .transform((v) => v || null),
  moneda: z.enum(MONEDAS, { error: 'Moneda no válida.' }),
  zonaHoraria: z.enum(ZONAS_HORARIAS, { error: 'Zona horaria no válida.' }),
});

/** GET /configuracion: solo la Coordinación (o un visitante) indica la iglesia. */
export const esquemaQueryConfiguracion = z.strictObject({
  iglesiaId: z.uuid('Iglesia no válida.').optional(),
});

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm.');

const camposHorario = {
  nombre: z.string().trim().min(1, 'Escribe el nombre de la reunión.').max(100),
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: hora,
  horaFin: hora
    .or(z.literal(''))
    .nullish()
    .transform((v) => v || null),
  lugar: opcional(150),
  activo: z.boolean(),
};

export const esquemaCrearHorario = z
  .strictObject({ ...camposHorario, activo: camposHorario.activo.default(true) })
  .refine((h) => !h.horaFin || h.horaFin > h.horaInicio, {
    path: ['horaFin'],
    message: 'La hora de fin debe ser posterior a la de inicio.',
  });

// En la edición parcial, la regla de horas se valida en el service contra el registro completo
export const esquemaEditarHorario = z.strictObject(camposHorario).partial();

export const esquemaIdHorario = z.object({ id: z.uuid('Identificador no válido.') });

export type DatosConfiguracion = z.infer<typeof esquemaConfiguracion>;
export type CrearHorario = z.infer<typeof esquemaCrearHorario>;
export type EditarHorario = z.infer<typeof esquemaEditarHorario>;
