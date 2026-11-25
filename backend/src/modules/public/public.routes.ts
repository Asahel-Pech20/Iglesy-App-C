import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../lib/appError';
import { validar } from '../../middlewares/validar';
import * as c from './public.controller';
import { esquemaIglesiaCartelera } from './public.schemas';
import { crearCacheCartelera } from './public.service';

/**
 * Rutas públicas (sin sesión). Se crean por instancia de la app para que cada prueba tenga
 * su propio contador de rate limit y su propia cache.
 */
export function crearPublicRouter() {
  const router = Router();
  const obtenerCartelera = crearCacheCartelera();
  const limite = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Demasiadas solicitudes, espera un minuto.', 429)),
  });

  // Alias heredado de AppIglesia: la cartelera de la iglesia inicial (E1-06b)
  router.get('/cartelera', limite, c.cartelera(obtenerCartelera));
  router.get(
    '/iglesias/:iglesiaId/cartelera',
    limite,
    validar({ params: esquemaIglesiaCartelera }),
    c.cartelera(obtenerCartelera),
  );
  return router;
}
