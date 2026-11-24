// Patrimonio (E2-08 y E2-10, Nataly): objetos de cada iglesia y criterios del índice.
// RF-13–RF-17, RF-22, RN-10, RN-11, RN-14, RN-16.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';
import { ESTADOS_OBJETO, GRUPOS_OBJETO, TIPOS_OBJETO } from './dominio/indice-patrimonial';

export { ESTADOS_OBJETO, TIPOS_OBJETO };

const texto = (max: number, falta: string) =>
  z.string().trim().min(1, falta).max(max, `Máximo ${max} caracteres.`);

const anio = z
  .number({ error: 'El año es un número.' })
  .int('El año es un número entero.')
  .min(1, 'Año no válido.')
  .max(2100, 'Año no válido.');
const siglo = z
  .number({ error: 'El siglo es un número (18 = siglo XVIII).' })
  .int('El siglo es un número entero (18 = siglo XVIII).')
  .min(1, 'Siglo no válido.')
  .max(21, 'Siglo no válido.');

const camposObjeto = {
  descripcion: texto(200, 'Escribe qué es el objeto.'),
  tipo: z.enum(TIPOS_OBJETO, { error: 'Elige un tipo de objeto válido.' }),
  anio: anio.nullable().optional(),
  siglo: siglo.nullable().optional(),
  material: texto(120, 'Escribe el material.'),
  estadoConservacion: texto(120, 'Escribe el estado de conservación.'),
  ubicacionEnTemplo: texto(150, 'Escribe dónde está en el templo.'),
  catalogadoInah: z.boolean({ error: 'Indica si está catalogado por el INAH.' }),
};

/** RN-10: sin año ni siglo no se puede calificar. Con los dos, cuenta el año (RN-02). */
function anioOSiglo(d: { anio?: number | null; siglo?: number | null }, ctx: z.RefinementCtx) {
  const hayAnio = d.anio !== undefined && d.anio !== null;
  const haySiglo = d.siglo !== undefined && d.siglo !== null;
  if (!hayAnio && !haySiglo)
    ctx.addIssue({
      code: 'custom',
      path: ['anio'],
      message: 'Escribe el año o, si no se conoce, el siglo.',
    });
  if (hayAnio && haySiglo && Math.ceil((d.anio as number) / 100) !== d.siglo)
    ctx.addIssue({ code: 'custom', path: ['siglo'], message: 'El año no es de ese siglo.' });
}

export const esquemaCrearObjeto = z.strictObject(camposObjeto).superRefine(anioOSiglo);

/** RF-14: cambia los datos, no el estado (eso va por su propia ruta). */
export const esquemaEditarObjeto = z
  .strictObject({
    descripcion: camposObjeto.descripcion.optional(),
    tipo: camposObjeto.tipo.optional(),
    anio: camposObjeto.anio,
    siglo: camposObjeto.siglo,
    material: camposObjeto.material.optional(),
    estadoConservacion: camposObjeto.estadoConservacion.optional(),
    ubicacionEnTemplo: camposObjeto.ubicacionEnTemplo.optional(),
    catalogadoInah: camposObjeto.catalogadoInah.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Envía al menos un dato para cambiar.');

/**
 * RF-15: PERDIDO, PRESTADO o BAJA con fecha y motivo. VIGENTE es el regreso de un objeto prestado
 * o perdido (supuesto mientras no responda P-08); una BAJA es definitiva.
 */
export const esquemaCambiarEstadoObjeto = z.strictObject({
  estado: z.enum(ESTADOS_OBJETO, { error: 'Elige un estado válido.' }),
  fecha: z.iso.date('Fecha no válida (formato yyyy-MM-dd).'),
  motivo: texto(500, 'Escribe el motivo.').min(3, 'Escribe el motivo.'),
});

export const esquemaListarObjetos = esquemaPaginacion.extend({
  estado: z.enum(ESTADOS_OBJETO).optional(),
  tipo: z.enum(TIPOS_OBJETO).optional(),
});

export const esquemaIdIglesia = z.object({ iglesiaId: z.uuid('Iglesia no válida.') });
export const esquemaIdObjeto = esquemaIdIglesia.extend({
  objetoId: z.uuid('Objeto no válido.'),
});

// ───────────── Criterios del índice (RF-22, ADR-0005) ─────────────

/** Un decimal como máximo: el cálculo trabaja en décimas enteras (ADR-0005). */
const conUnDecimal = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
const puntos = z
  .number({ error: 'Escribe un número.' })
  .min(0, 'No puede ser negativo.')
  .max(1000, 'Máximo 1000.')
  .refine(conUnDecimal, 'Usa como máximo un decimal.');

export const esquemaCriterios = z
  .strictObject({
    rangosEdad: z
      .array(
        z.strictObject({
          desdeAnios: z.number().int('Años enteros.').min(0).max(5000),
          puntos,
        }),
      )
      .min(1, 'Agrega al menos un rango de antigüedad.')
      .max(20),
    multiplicadores: z.strictObject(
      Object.fromEntries(GRUPOS_OBJETO.map((g) => [g, puntos.max(10, 'Máximo 10.')])) as Record<
        (typeof GRUPOS_OBJETO)[number],
        typeof puntos
      >,
    ),
    puntosInah: puntos,
    distinciones: z
      .array(
        z.strictObject({
          minimo: puntos.refine((n) => n > 0, 'El mínimo debe ser mayor que 0.'),
          nombre: texto(60, 'Escribe el nombre de la distinción.'),
        }),
      )
      .max(10),
  })
  .superRefine((c, ctx) => {
    // Rangos sin huecos: el primero desde 0 años y cada uno empieza después del anterior
    if (c.rangosEdad[0]?.desdeAnios !== 0)
      ctx.addIssue({
        code: 'custom',
        path: ['rangosEdad', 0, 'desdeAnios'],
        message: 'El primer rango empieza en 0 años.',
      });
    c.rangosEdad.forEach((r, i) => {
      if (i > 0 && r.desdeAnios <= (c.rangosEdad[i - 1] as { desdeAnios: number }).desdeAnios)
        ctx.addIssue({
          code: 'custom',
          path: ['rangosEdad', i, 'desdeAnios'],
          message: 'Ordena los rangos de menor a mayor antigüedad, sin repetir.',
        });
    });
    // Distinciones de mayor a menor mínimo y con nombres distintos
    c.distinciones.forEach((d, i) => {
      if (i > 0 && d.minimo >= (c.distinciones[i - 1] as { minimo: number }).minimo)
        ctx.addIssue({
          code: 'custom',
          path: ['distinciones', i, 'minimo'],
          message: 'Ordena las distinciones de mayor a menor mínimo, sin repetir.',
        });
    });
    const nombres = c.distinciones.map((d) => d.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length)
      ctx.addIssue({
        code: 'custom',
        path: ['distinciones'],
        message: 'Cada distinción necesita un nombre distinto.',
      });
  });

export const esquemaHistorialCriterios = esquemaPaginacion;

export type CrearObjeto = z.infer<typeof esquemaCrearObjeto>;
export type EditarObjeto = z.infer<typeof esquemaEditarObjeto>;
export type CambiarEstadoObjeto = z.infer<typeof esquemaCambiarEstadoObjeto>;
export type QueryListarObjetos = z.infer<typeof esquemaListarObjetos>;
export type Criterios = z.infer<typeof esquemaCriterios>;
export type QueryHistorialCriterios = z.infer<typeof esquemaHistorialCriterios>;
