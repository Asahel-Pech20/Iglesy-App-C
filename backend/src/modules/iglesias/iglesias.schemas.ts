// Iglesias (base de Oscar, ampliada en E2-06 por Nataly): RF-07, RF-08, RF-11, RF-12, RN-08, RN-09.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';
import { digitos as clave } from '../catalogos/catalogos.schemas';

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
// Opcionales: texto vacío (o solo espacios) o null se guardan como null. A2-E2-05: se recorta
// antes de comparar; si no, «   » llegaba a coordenada() como '' y Number('') daba 0.
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    esquema.nullable().optional(),
  );

const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'El teléfono debe tener de 7 a 15 dígitos.'));
const correo = z.string().trim().toLowerCase().pipe(z.email('Correo no válido.'));
// Solo https: la foto se muestra en una página https y un enlace http daría contenido mixto
const urlHttps = z
  .string()
  .trim()
  .max(500, 'Máximo 500 caracteres.')
  .pipe(z.url({ protocol: /^https$/, error: 'Usa una dirección https:// válida.' }));

// Coordenadas: se reciben como número o texto y se guardan con 6 decimales (RF-07)
const coordenada = (limite: number, nombre: string) =>
  z
    .union([z.number(), z.string().trim().min(1, `Escribe la ${nombre.toLowerCase()}.`)])
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
  // Foto por URL (sin subir archivos) y lo que su licencia pide mostrar
  fotoUrl: opcional(urlHttps),
  fotoAutor: opcional(texto(150)),
  fotoLicencia: opcional(texto(60)),
  fotoLicenciaUrl: opcional(urlHttps),
  fotoEnlace: opcional(urlHttps),
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

const capacidadFiltro = z.coerce
  .number({ error: 'La capacidad es un número.' })
  .int('La capacidad es un número entero.')
  .positive('La capacidad debe ser mayor que 0.')
  .max(100_000);

/**
 * E2-07: filtros de la lista pública (RF-02–RF-05). Supuestos mientras no haya respuesta:
 * P-02, `q` busca parte del nombre sin distinguir mayúsculas (los acentos sí cuentan);
 * P-03, se acepta mínimo y máximo, así sirve tanto «al menos 200» como un rango.
 */
export const esquemaListaPublica = esquemaPaginacion
  .extend({
    // RF-01: el visitante siempre elige un estado
    estado: clave(2),
    municipio: clave(5).optional(),
    localidad: clave(9).optional(),
    tipo: z.enum(TIPOS_IGLESIA, { error: 'Elige un tipo de iglesia válido.' }).optional(),
    q: z.string().trim().max(100).optional(),
    capacidadMin: capacidadFiltro.optional(),
    capacidadMax: capacidadFiltro.optional(),
  })
  .refine(
    (d) =>
      d.capacidadMin === undefined ||
      d.capacidadMax === undefined ||
      d.capacidadMin <= d.capacidadMax,
    { path: ['capacidadMax'], message: 'La capacidad máxima no puede ser menor que la mínima.' },
  );

export type CrearIglesia = z.infer<typeof esquemaCrearIglesia>;
export type EditarIglesia = z.infer<typeof esquemaEditarIglesia>;
export type CerrarIglesia = z.infer<typeof esquemaCerrarIglesia>;
export type QueryListarIglesias = z.infer<typeof esquemaListarIglesias>;
export type QueryListaPublica = z.infer<typeof esquemaListaPublica>;
