// Versión mínima del módulo de iglesias: lo que hace falta para que el personal tenga una iglesia
// a la que pertenecer (listar y crear). El módulo completo (ubicación, patrimonio, cierre) lo amplía Nataly.
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

export const esquemaCrearIglesia = z.strictObject({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(150, 'Máximo 150 caracteres.'),
  tipo: z.enum(TIPOS_IGLESIA, { error: 'Elige un tipo de iglesia válido.' }),
  zonaHoraria: z
    .string()
    .trim()
    .refine(zonaValida, 'Zona horaria no válida (ej. America/Mexico_City).')
    .default('America/Mexico_City'),
});

export const esquemaListarIglesias = esquemaPaginacion.extend({
  q: z.string().trim().max(100).optional(),
});

export type CrearIglesia = z.infer<typeof esquemaCrearIglesia>;
export type QueryListarIglesias = z.infer<typeof esquemaListarIglesias>;
