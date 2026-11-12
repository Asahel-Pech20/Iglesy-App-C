// Catálogo del INEGI (E2-05, RF-09, RF-10, RN-09, RNF-05).
import { z } from 'zod';

export const MAX_FILAS_IMPORTACION = 5000;

const nombre = z.string().trim().min(1, 'Escribe el nombre.').max(150, 'Máximo 150 caracteres.');
const digitos = (n: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${n}}$`), `La clave debe tener ${n} dígitos.`);

/**
 * Una fila con las columnas del catálogo del INEGI (CVE_ENT, NOM_ENT, CVE_MUN, NOM_MUN, CVE_LOC,
 * NOM_LOC). Las claves de municipio (3) y localidad (4) son las del INEGI, sin el prefijo del padre.
 */
export const esquemaFilaCatalogo = z
  .strictObject({
    cveEnt: digitos(2),
    nomEnt: nombre,
    cveMun: digitos(3).optional(),
    nomMun: nombre.optional(),
    cveLoc: digitos(4).optional(),
    nomLoc: nombre.optional(),
  })
  .superRefine((f, ctx) => {
    if ((f.cveMun === undefined) !== (f.nomMun === undefined))
      ctx.addIssue({
        code: 'custom',
        path: ['cveMun'],
        message: 'El municipio lleva clave y nombre.',
      });
    if ((f.cveLoc === undefined) !== (f.nomLoc === undefined))
      ctx.addIssue({
        code: 'custom',
        path: ['cveLoc'],
        message: 'La localidad lleva clave y nombre.',
      });
    if (f.cveLoc !== undefined && f.cveMun === undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['cveMun'],
        message: 'Una localidad necesita su municipio.',
      });
  });

export const esquemaImportacion = z.strictObject({
  filas: z
    .array(esquemaFilaCatalogo)
    .min(1, 'Envía al menos una fila.')
    .max(MAX_FILAS_IMPORTACION, `Máximo ${MAX_FILAS_IMPORTACION} filas por envío.`),
});

export const esquemaClaveEstado = z.object({ clave: digitos(2) });
export const esquemaClaveMunicipio = z.object({ clave: digitos(5) });

export type FilaCatalogo = z.infer<typeof esquemaFilaCatalogo>;
export type Importacion = z.infer<typeof esquemaImportacion>;
