import type { RequestHandler } from 'express';
import { ok } from '../../lib/respuesta';
import type { crearCacheCartelera } from './public.service';

/** `/cartelera` (iglesia inicial) y `/iglesias/:iglesiaId/cartelera` (E1-06b). */
export function cartelera(obtener: ReturnType<typeof crearCacheCartelera>): RequestHandler {
  return async function cartelera(req, res) {
    const { iglesiaId } = req.params as { iglesiaId?: string };
    res.json(ok(await obtener(iglesiaId)));
  };
}
