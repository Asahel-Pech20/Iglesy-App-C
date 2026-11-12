// Iglesias (base de Oscar, ampliada en E2-06 por Nataly): RF-07, RF-08, RF-11, RF-12, RN-08, RN-09.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';

export const TIPOS_IGLESIA = [
  'CATEDRAL',
  'BASILICA',
  'PARROQUIA',
  'TEMPLO',
  'CAPILLA',
  'SANTUARIO',
] as const;

const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

const texto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const clave = (n: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${n}}$`), `La clave debe tener ${n} dígitos.`);

// Opcionales: cadena vacía o null se guardan como null (mismo criterio que miembros)
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (v === '' ? null : v), esquema.nullable().optional());

const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'El teléfono debe tener de 7 a 15 dígitos.'));
const correo = z.string().trim().toLowerCase().pipe(z.email('Correo no válido.'));

// Coordenadas: se reciben como número o texto y se guardan con 6 decimales (RF-07)
const coordenada = (limite: number, nombre: string) =>
  z
    .union([z.number(), z.string().trim()])
    .transform((v) => Number(v))
    .pipe(
      z
        .number({ error: `${nombre} no válida.` })
        .min(-limite, `${nombre} fuera de rango.`)
        .max(limite, `${nombre} fuera de rango.`),
    );

const camposDatos = {
  direccion: opcional(texto(250)),
  estado: opcional(clave(2)),
  municipio: opcional(clave(5)),
  localidad: opcional(clave(9)),
  capacidad: opcional(
    z
      .number()
      .int('La capacidad es un número entero.')
      .positive('La capacidad debe ser mayor que 0.')
      .max(100_000),
  ),
  anioConstruccion: opcional(
    z
      .number()
      .int('El año es un número entero.')
      .min(1500, 'Año no válido.')
      .max(2100, 'Año no válido.'),
  ),
  telefono: opcional(telefono),
  correo: opcional(correo),
  latitud: opcional(coordenada(90, 'Latitud')),
  longitud: opcional(coordenada(180, 'Longitud')),
};

const camposBase = {
  nombre: texto(150).min(1, 'Escribe el nombre.'),
  tipo: z.enum(TIPOS_IGLESIA, { error: 'Elige un tipo de iglesia válido.' }),
  zonaHoraria: z
    .string()
    .trim()
    .refine(zonaValida, 'Zona horaria no válida (ej. America/Mexico_City).'),
};

/** Latitud y longitud van juntas: las dos o ninguna. */
function coordenadasJuntas(
  d: { latitud?: number | null; longitud?: number | null },
  ctx: z.RefinementCtx,
) {
  const hayLat = d.latitud !== undefined && d.latitud !== null;
  const hayLon = d.longitud !== undefined && d.longitud !== null;
  if (hayLat !== hayLon)
    ctx.addIssue({
      code: 'custom',
      path: [hayLat ? 'longitud' : 'latitud'],
      message: 'Escribe latitud y longitud juntas.',
    });
}

export const esquemaCrearIglesia = z
  .strictObject({
    ...camposBase,
    zonaHoraria: camposBase.zonaHoraria.default('America/Mexico_City'),
    ...camposDatos,
  })
  .superRefine(coordenadasJuntas);

export const esquemaEditarIglesia = z
  .strictObject({
    nombre: camposBase.nombre.optional(),
    tipo: camposBase.tipo.optional(),
    zonaHoraria: camposBase.zonaHoraria.optional(),
    ...camposDatos,
  })
  .superRefine(coordenadasJuntas)
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un dato para cambiar.');

export const esquemaCerrarIglesia = z.strictObject({
  fecha: z.iso.date('Fecha no válida (formato yyyy-MM-dd).'),
  motivo: texto(500).min(3, 'Escribe el motivo del cierre.'),
});

export const esquemaListarIglesias = esquemaPaginacion.extend({
  q: z.string().trim().max(100).optional(),
  estado: clave(2).optional(),
  municipio: clave(5).optional(),
  tipo: z.enum(TIPOS_IGLESIA).optional(),
  situacion: z.enum(['activas', 'cerradas', 'todas']).default('todas'),
});

export const esquemaIdIglesia = z.object({ iglesiaId: z.uuid('Iglesia no válida.') });

export type CrearIglesia = z.infer<typeof esquemaCrearIglesia>;
export type EditarIglesia = z.infer<typeof esquemaEditarIglesia>;
export type CerrarIglesia = z.infer<typeof esquemaCerrarIglesia>;
export type QueryListarIglesias = z.infer<typeof esquemaListarIglesias>;
