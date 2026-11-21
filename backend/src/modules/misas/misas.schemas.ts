// Versión mínima del módulo de misas: lo que el diezmo necesita (padres y misas celebradas).
// El módulo completo (horario semanal, sustituciones, agenda del padre) lo amplía Genaro.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';

const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato aaaa-mm-dd.');

export const esquemaIglesia = z.object({ iglesiaId: z.uuid('Identificador no válido.') });

export const esquemaCrearPadre = z.strictObject({
  nombre: z.string().trim().min(1, 'Escribe el nombre.').max(120, 'Máximo 120 caracteres.'),
});

export const esquemaCrearMisa = z.strictObject({
  inicio: z.iso.datetime({ offset: true, message: 'Usa fecha y hora ISO 8601.' }),
  padreId: z.uuid('Identificador no válido.'),
});

export const esquemaListarMisas = esquemaPaginacion.extend({
  desde: fechaDia.optional(),
  hasta: fechaDia.optional(),
});

export type CrearPadre = z.infer<typeof esquemaCrearPadre>;
export type CrearMisa = z.infer<typeof esquemaCrearMisa>;
export type QueryListarMisas = z.infer<typeof esquemaListarMisas>;
