// Servicios y pláticas de una iglesia (E3-11 a E3-14, Genaro). RF-30–39, RN-22–25; supuestos P-10–14.
import { z } from 'zod';

const id = z.uuid('Identificador no válido.');

export const esquemaIglesia = z.object({ iglesiaId: id });
export const esquemaServicioDeIglesia = z.object({ iglesiaId: id, servicioId: id });
export const esquemaPlaticaDeIglesia = z.object({ iglesiaId: id, platicaId: id });

// Dinero como texto con hasta 2 decimales, igual que el diezmo (RNF-06): cabe en Decimal(12,2)
const dinero = z
  .string('Escribe el monto como texto, por ejemplo "350.00".')
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Usa un monto con hasta 2 decimales, sin signo ni comas.');

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((t) => (t === '' ? null : t))
    .nullable();

const horario = z.strictObject({
  diaSemana: z
    .number('Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .int('Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .min(0, 'Indica el día con un número de 0 (domingo) a 6 (sábado).')
    .max(6, 'Indica el día con un número de 0 (domingo) a 6 (sábado).'),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa la hora con el formato HH:mm.'),
});

const horarios = z
  .array(horario, 'Indica los horarios como una lista.')
  .max(21, 'Máximo 21 horarios.')
  .refine(
    (lista) => new Set(lista.map((h) => `${h.diaSemana} ${h.hora}`)).size === lista.length,
    'No repitas el mismo día y hora.',
  );

// ───────────── Servicios (RF-30–RF-34, RN-22, RN-23) ─────────────

export const FORMAS_COSTO = ['MONTO', 'GRATUITO', 'DONATIVO'] as const;

const camposServicio = {
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(80, 'Máximo 80 caracteres.'),
  formaCosto: z.enum(FORMAS_COSTO, 'El costo es MONTO, GRATUITO o DONATIVO.'),
  // MONTO: obligatorio; DONATIVO: sugerido opcional; GRATUITO: sin monto
  monto: dinero.nullable(),
  requisitos: textoOpcional(1000),
  duracionMin: z
    .number('Indica la duración en minutos.')
    .int('Indica la duración en minutos enteros.')
    .min(1, 'La duración va de 1 a 1440 minutos.')
    .max(1440, 'La duración va de 1 a 1440 minutos.')
    .nullable(),
  requiereCita: z.boolean('Indica true o false.'),
  horarios,
};

/** Regla de costo de RN-22 (supuesto P-11); se usa al crear y al editar con los datos combinados. */
export function errorDeCosto(formaCosto: string, monto: string | null | undefined): string | null {
  const valor = monto === null || monto === undefined ? null : Number(monto);
  if (formaCosto === 'MONTO' && (valor === null || valor <= 0)) {
    return 'Un servicio con costo necesita un monto mayor que cero.';
  }
  if (formaCosto === 'GRATUITO' && valor !== null) return 'Un servicio gratuito no lleva monto.';
  if (formaCosto === 'DONATIVO' && valor !== null && valor <= 0) {
    return 'El donativo sugerido debe ser mayor que cero.';
  }
  return null;
}

export const esquemaCrearServicio = z
  .strictObject({
    nombre: camposServicio.nombre,
    formaCosto: camposServicio.formaCosto,
    monto: camposServicio.monto.optional(),
    requisitos: camposServicio.requisitos.optional(),
    duracionMin: camposServicio.duracionMin.optional(),
    requiereCita: camposServicio.requiereCita.optional(),
    horarios: camposServicio.horarios.optional(),
  })
  .superRefine((d, ctx) => {
    const error = errorDeCosto(d.formaCosto, d.monto);
    if (error) ctx.addIssue({ code: 'custom', path: ['monto'], message: error });
  });

export const esquemaActualizarServicio = z
  .strictObject({
    nombre: camposServicio.nombre.optional(),
    formaCosto: camposServicio.formaCosto.optional(),
    monto: camposServicio.monto.optional(),
    requisitos: camposServicio.requisitos.optional(),
    duracionMin: camposServicio.duracionMin.optional(),
    requiereCita: camposServicio.requiereCita.optional(),
    horarios: camposServicio.horarios.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Indica al menos un dato que cambiar.');

// ───────────── Pláticas (RF-36–RF-39, RN-24, RN-25) ─────────────

export const TIPOS_PLATICA = [
  'PREBAUTISMAL',
  'PRIMERA_COMUNION',
  'CONFIRMACION',
  'PREMATRIMONIAL',
] as const;

const camposPlatica = {
  tipo: z.enum(
    TIPOS_PLATICA,
    'El tipo es prebautismal, de primera comunión, de confirmación o prematrimonial.',
  ),
  sesiones: z
    .number('Indica cuántas sesiones tiene.')
    .int('Indica un número entero de sesiones.')
    .min(1, 'Las sesiones van de 1 a 100.')
    .max(100, 'Las sesiones van de 1 a 100.'),
  // 0.00 = gratuita
  costo: dinero,
  cupo: z
    .number('Indica cuántas personas caben.')
    .int('Indica un número entero de personas.')
    .min(1, 'El cupo va de 1 a 10000 personas.')
    .max(10000, 'El cupo va de 1 a 10000 personas.'),
  lugar: z.string().trim().min(1, 'Escribe dónde es.').max(200, 'Máximo 200 caracteres.'),
  imparte: z.string().trim().min(1, 'Escribe quién la da.').max(200, 'Máximo 200 caracteres.'),
  padreId: id.nullable(),
  horarios: horarios.min(1, 'Indica al menos un día y hora.'),
};

export const esquemaCrearPlatica = z.strictObject({
  ...camposPlatica,
  padreId: camposPlatica.padreId.optional(),
});

export const esquemaActualizarPlatica = z
  .strictObject({
    tipo: camposPlatica.tipo.optional(),
    sesiones: camposPlatica.sesiones.optional(),
    costo: camposPlatica.costo.optional(),
    cupo: camposPlatica.cupo.optional(),
    lugar: camposPlatica.lugar.optional(),
    imparte: camposPlatica.imparte.optional(),
    padreId: camposPlatica.padreId.optional(),
    horarios: camposPlatica.horarios.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Indica al menos un dato que cambiar.');

// RF-39: «¿cuándo son las pláticas de bautizo?»
export const esquemaPlaticasPublicas = z.object({
  tipo: z.enum(TIPOS_PLATICA, 'Elige un tipo de plática de la lista.').optional(),
});

export type Horario = z.infer<typeof horario>;
export type CrearServicio = z.infer<typeof esquemaCrearServicio>;
export type ActualizarServicio = z.infer<typeof esquemaActualizarServicio>;
export type CrearPlatica = z.infer<typeof esquemaCrearPlatica>;
export type ActualizarPlatica = z.infer<typeof esquemaActualizarPlatica>;
export type QueryPlaticasPublicas = z.infer<typeof esquemaPlaticasPublicas>;
