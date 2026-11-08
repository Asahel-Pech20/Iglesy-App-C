import { type Router as TipoRouter, Router } from 'express';
import { anunciosRouter } from './modules/anuncios/anuncios.routes';
import { asistenciaEventoRouter, asistenciasRouter } from './modules/asistencia/asistencia.routes';
import { crearAuthRouter } from './modules/auth/auth.routes';
import { configuracionRouter } from './modules/configuracion/configuracion.routes';
import { crearDashboardRouter } from './modules/dashboard/dashboard.routes';
import { diezmoRouter } from './modules/diezmo/diezmo.routes';
import { donacionesRouter } from './modules/donaciones/donaciones.routes';
import { iglesiasRouter } from './modules/iglesias/iglesias.routes';
import { eventosRouter } from './modules/eventos/eventos.routes';
import { miembrosRouter } from './modules/miembros/miembros.routes';
import { misasRouter } from './modules/misas/misas.routes';
import { ministeriosRouter } from './modules/ministerios/ministerios.routes';
import { crearPublicRouter } from './modules/public/public.routes';
import { reportesRouter } from './modules/reportes/reportes.routes';
import { usuariosRouter } from './modules/usuarios/usuarios.routes';

export interface ModuloApi {
  prefijo: string;
  router: TipoRouter;
}

/**
 * Registro de módulos de la API. B2–B4: agreguen aquí su módulo ({ prefijo: '/miembros', router: miembrosRouter }).
 * La prueba de rutas protegidas (B1-18) recorre esta lista.
 */
export function crearModulos(): ModuloApi[] {
  return [
    { prefijo: '/auth', router: crearAuthRouter() },
    { prefijo: '/usuarios', router: usuariosRouter },
    { prefijo: '/configuracion', router: configuracionRouter },
    { prefijo: '/miembros', router: miembrosRouter },
    { prefijo: '/ministerios', router: ministeriosRouter },
    { prefijo: '/eventos', router: eventosRouter },
    { prefijo: '/eventos', router: asistenciaEventoRouter },
    { prefijo: '/asistencias', router: asistenciasRouter },
    { prefijo: '/anuncios', router: anunciosRouter },
    { prefijo: '/public', router: crearPublicRouter() },
    { prefijo: '/donaciones', router: donacionesRouter },
    { prefijo: '/dashboard', router: crearDashboardRouter() },
    { prefijo: '/reportes', router: reportesRouter },
    { prefijo: '/iglesias', router: iglesiasRouter },
    // Ecclesia: datos internos de una iglesia; cada ruta pasa por alcanceIglesia
    { prefijo: '/iglesias/:iglesiaId', router: misasRouter },
    { prefijo: '/iglesias/:iglesiaId', router: diezmoRouter },
  ];
}

export function crearApiRouter() {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });
  for (const { prefijo, router: modulo } of crearModulos()) router.use(prefijo, modulo);
  return router;
}
