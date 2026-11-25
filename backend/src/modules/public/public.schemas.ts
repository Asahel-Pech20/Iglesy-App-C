import { z } from 'zod';

/** GET /public/iglesias/:iglesiaId/cartelera (E1-06b): id no válido → 400. */
export const esquemaIglesiaCartelera = z.object({ iglesiaId: z.uuid('Iglesia no válida.') });
