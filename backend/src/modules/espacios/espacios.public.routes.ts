// Rutas públicas de espacios, bajo /public (sin cuenta). No pasan por alcanceIglesia ni por
// autenticar: cada una revisa en el service que la iglesia esté activa (una cerrada ya no recibe
// solicitudes ni respuestas). Se crean por instancia de la app para que cada prueba tenga su propio
// contador de peticiones. El parámetro se llama :iglesiaId, igual que la ficha pública de la iglesia.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../lib/appError';
import { validar } from '../../middlewares/validar';
import * as c from './espacios.controller';
import {
  esquemaClave,
  esquemaCrearSolicitud,
  esquemaFolio,
  esquemaIglesiaPublica,
} from './espacios.schemas';

function limitePorMinuto(limite: number) {
  return rateLimit({
    windowMs: 60_000,
    limit: limite,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Demasiadas solicitudes, espera un minuto.', 429)),
  });
}

export function crearEspaciosPublicRouter() {
  const router = Router();
  const lectura = limitePorMinuto(60);
  // Crear solicitudes y probar claves es lo que más conviene frenar por IP
  const creacion = limitePorMinuto(10);
  const acceso = limitePorMinuto(30);

  router.get(
    '/iglesias/:iglesiaId/espacios',
    lectura,
    validar({ params: esquemaIglesiaPublica }),
    c.tiposPublicos,
  );
  router.post(
    '/iglesias/:iglesiaId/solicitudes-espacio',
    creacion,
    validar({ params: esquemaIglesiaPublica, body: esquemaCrearSolicitud }),
    c.crearSolicitud,
  );
  router.post(
    '/solicitudes-espacio/:folio/consulta',
    acceso,
    validar({ params: esquemaFolio, body: esquemaClave }),
    c.consultar,
  );
  router.post(
    '/solicitudes-espacio/:folio/aceptar',
    acceso,
    validar({ params: esquemaFolio, body: esquemaClave }),
    c.responder('ACEPTAR'),
  );
  router.post(
    '/solicitudes-espacio/:folio/rechazar',
    acceso,
    validar({ params: esquemaFolio, body: esquemaClave }),
    c.responder('RECHAZAR'),
  );
  router.post(
    '/solicitudes-espacio/:folio/cancelar',
    acceso,
    validar({ params: esquemaFolio, body: esquemaClave }),
    c.responder('CANCELAR'),
  );
  return router;
}
