import { type RequestHandler, Router } from 'express';
import { env } from '../../config/env';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../lib/appError';
import { autenticar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './auth.controller';
import {
  esquemaCambiarPassword,
  esquemaLogin,
  esquemaOlvide,
  esquemaRestablecer,
} from './auth.schemas';

// Se crea por instancia de la app para que cada prueba tenga su propio contador
function limitePorMinuto(limite: number) {
  return rateLimit({
    windowMs: 60_000,
    limit: limite,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Demasiados intentos, espera un minuto.', 429)),
  });
}

/**
 * Con COOKIE_SAMESITE=none el navegador manda la cookie desde cualquier sitio: las rutas que la usan
 * (refresh y logout) solo se aceptan si la petición viene del frontend (Origin = FRONTEND_URL).
 * Con «strict» o «lax» no hace falta y no se revisa (así siguen igual el desarrollo y las pruebas).
 */
export function exigirOrigenFrontend(
  config: Pick<typeof env, 'COOKIE_SAMESITE' | 'FRONTEND_URL'> = env,
): RequestHandler {
  const permitido = new URL(config.FRONTEND_URL).origin;
  return (req, _res, next) => {
    if (config.COOKIE_SAMESITE !== 'none' || req.get('origin') === permitido) return next();
    next(new AppError('FORBIDDEN', 'Origen no permitido.', 403));
  };
}

export function crearAuthRouter() {
  const router = Router();
  router.post('/login', limitePorMinuto(5), validar({ body: esquemaLogin }), c.login);
  router.post('/refresh', exigirOrigenFrontend(), c.refrescar);
  // Solo con la cookie: así se puede cerrar sesión aunque el access token ya haya vencido
  router.post('/logout', exigirOrigenFrontend(), c.logout);
  router.post('/forgot-password', limitePorMinuto(5), validar({ body: esquemaOlvide }), c.olvide);
  router.post(
    '/reset-password',
    limitePorMinuto(10),
    validar({ body: esquemaRestablecer }),
    c.restablecer,
  );
  router.get('/me', autenticar, c.me);
  router.patch(
    '/me/password',
    autenticar,
    validar({ body: esquemaCambiarPassword }),
    c.cambiarPassword,
  );
  return router;
}
