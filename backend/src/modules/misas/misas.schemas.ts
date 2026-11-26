// Módulo de misas: padres, horario semanal (E3-06, E3-07, Genaro) y misas celebradas (versión
// mínima que usa el diezmo; E3-09 la amplía con la sustitución).
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';

const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato aaaa-mm-dd.');
const id = z.uuid('Identificador no válido.');

export const esquemaIglesia = z.object({ iglesiaId: id });
export const esquemaPadreDeIglesia = z.object({ iglesiaId: id, padreId: id });
export const esquemaIdPadre = z.object({ padreId: id });
export const esquemaHorarioDeIglesia = z.object({ iglesiaId: id, horarioId: id });

// ───────────── Padres (RF-40, RF-41; supuesto P-19) ─────────────

const nombrePadre = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre.')
  .max(120, 'Máximo 120 caracteres.');
// «Pbro.», «Fr.», «Mons.»…; vacío = sin título
const tituloPadre = z
  .string()
  .trim()
  .max(30, 'Máximo 30 caracteres.')
  .transform((t) => (t === '' ? null : t))
  .nullable();

export const esquemaCrearPadre = z.strictObject({
  nombre: nombrePadre,
  titulo: tituloPadre.optional(),
});

export const esquemaActualizarPadre = z
  .strictObject({
    nombre: nombrePadre.optional(),
    titulo: tituloPadre.optional(),
    activo: z.boolean('Indica true o false.').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Indica al menos un dato que cambiar.');

export const esquemaBuscarPadres = esquemaPaginacion.extend({
  q: z.string().trim().max(120, 'Máximo 120 caracteres.').optional(),
});

// ───────────── Horario semanal (RF-42, RF-43, RF-46; RN-20, RN-21, RN-27) ─────────────

export const TIPOS_MISA = ['DIARIA', 'DOMINICAL', 'ESPECIAL'] as const;
export const IDIOMAS_MISA = [
  'ESPANOL',
  'NAHUATL',
  'MAYA',
  'TSELTAL',
  'TSOTSIL',
  'MIXTECO',
  'ZAPOTECO',
  'OTOMI',
  'TOTONACO',
  'MAZATECO',
  'CHOL',
  'OTRO',
] as const;

const camposHorario = {
  diaSemana: z
    .number('Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .int('Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .min(0, 'Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .max(6, 'Indica el día con un número de 0 (domingo) a 6 (sábado).'),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa la hora con el formato HH:mm.'),
  tipo: z.enum(TIPOS_MISA, 'El tipo es diaria, dominical o especial.'),
  idioma: z.enum(IDIOMAS_MISA, 'Elige un idioma de la lista.'),
  // null = una hora (RN-27)
  duracionMin: z
    .number('Indica la duración en minutos.')
    .int('Indica la duración en minutos enteros.')
    .min(1, 'La duración va de 1 a 720 minutos.')
    .max(720, 'La duración va de 1 a 720 minutos.')
    .nullable(),
  padreId: id,
};

export const esquemaCrearHorario = z.strictObject({
  ...camposHorario,
  idioma: camposHorario.idioma.optional(),
  duracionMin: camposHorario.duracionMin.optional(),
});

export const esquemaActualizarHorario = z
  .strictObject({
    diaSemana: camposHorario.diaSemana.optional(),
    hora: camposHorario.hora.optional(),
    tipo: camposHorario.tipo.optional(),
    idioma: camposHorario.idioma.optional(),
    duracionMin: camposHorario.duracionMin.optional(),
    padreId: camposHorario.padreId.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Indica al menos un dato que cambiar.');

// ───────────── Agenda semanal de un padre (E3-08: RF-47) ─────────────

export const esquemaAgenda = z.object({
  // Cualquier día de la semana que se quiere ver; por omisión, la semana en curso
  semana: fechaDia.optional(),
});

// RF-84: semana a armar; cualquier día de esa semana (por omisión, la actual)
export const esquemaArmarSemana = z.strictObject({ semana: fechaDia.optional() });

// ───────────── Misas celebradas (E3-09: RF-48–RF-51) ─────────────

// Forma del diezmo (E4) y de una misa especial de una sola fecha (P-16): instante y padre
const esquemaMisaSuelta = z.strictObject({
  inicio: z.iso.datetime({ offset: true, message: 'Usa fecha y hora ISO 8601.' }),
  padreId: id,
});

// A partir de una misa del horario: la hora sale del horario. Si el padre que la dio no es el
// programado, es una sustitución y lleva motivo (RF-49)
const esquemaMisaDeHorario = z.strictObject({
  horarioMisaId: id,
  fecha: fechaDia,
  padreId: id.optional(),
  motivo: z
    .string()
    .trim()
    .min(1, 'Escribe el motivo.')
    .max(300, 'Máximo 300 caracteres.')
    .optional(),
});

export const esquemaCrearMisa = z.union([esquemaMisaDeHorario, esquemaMisaSuelta], {
  error: 'Indica la misa del horario y la fecha, o el inicio y el padre.',
});

export const esquemaListarMisas = esquemaPaginacion.extend({
  desde: fechaDia.optional(),
  hasta: fechaDia.optional(),
});

// ───────────── Días inhábiles (E3-25, supuesto P-33) ─────────────

export const TIPOS_EXCEPCION = ['SIN_MISA', 'OTRA_HORA'] as const;

export const esquemaExcepcionDeIglesia = z.object({ iglesiaId: id, excepcionId: id });

// Una fecha en la que una misa del horario no se celebra (SIN_MISA) o se celebra a otra hora
export const esquemaCrearExcepcion = z
  .strictObject({
    horarioMisaId: id,
    fecha: fechaDia,
    tipo: z.enum(TIPOS_EXCEPCION, 'El tipo es «sin misa» u «otra hora».'),
    horaNueva: camposHorario.hora.optional(),
    motivo: z
      .string('Escribe el motivo.')
      .trim()
      .min(3, 'Escribe el motivo (al menos 3 caracteres).')
      .max(300, 'Máximo 300 caracteres.'),
  })
  .superRefine((d, ctx) => {
    if (d.tipo === 'OTRA_HORA' && !d.horaNueva) {
      ctx.addIssue({ code: 'custom', path: ['horaNueva'], message: 'Indica la hora nueva.' });
    }
    if (d.tipo === 'SIN_MISA' && d.horaNueva) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaNueva'],
        message: 'La hora nueva solo va con «otra hora».',
      });
    }
  });

// Periodo a consultar; por omisión, de hoy a 60 días (fechas locales de la iglesia)
export const esquemaListarExcepciones = z
  .object({ desde: fechaDia.optional(), hasta: fechaDia.optional() })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    path: ['desde'],
    message: 'La fecha inicial no puede ser posterior a la final.',
  });

export type CrearExcepcion = z.infer<typeof esquemaCrearExcepcion>;
export type QueryListarExcepciones = z.infer<typeof esquemaListarExcepciones>;

export type CrearPadre = z.infer<typeof esquemaCrearPadre>;
export type ActualizarPadre = z.infer<typeof esquemaActualizarPadre>;
export type QueryBuscarPadres = z.infer<typeof esquemaBuscarPadres>;
export type CrearHorario = z.infer<typeof esquemaCrearHorario>;
export type ActualizarHorario = z.infer<typeof esquemaActualizarHorario>;
export type CrearMisa = z.infer<typeof esquemaCrearMisa>;
export type CrearMisaDeHorario = z.infer<typeof esquemaMisaDeHorario>;
export type QueryAgenda = z.infer<typeof esquemaAgenda>;
export type QueryListarMisas = z.infer<typeof esquemaListarMisas>;
