import { type Router as TipoRouter, Router } from 'express';
import { anunciosRouter } from './modules/anuncios/anuncios.routes';
import { asistenciaEventoRouter, asistenciasRouter } from './modules/asistencia/asistencia.routes';
import { catalogosPublicoRouter, catalogosRouter } from './modules/catalogos/catalogos.routes';
import { crearAuthRouter } from './modules/auth/auth.routes';
import { configuracionRouter } from './modules/configuracion/configuracion.routes';
import { crearDashboardRouter } from './modules/dashboard/dashboard.routes';
import { diezmoRouter } from './modules/diezmo/diezmo.routes';
import { donacionesRouter } from './modules/donaciones/donaciones.routes';
import { consultasPublicasRouter } from './modules/consultas/consultas.routes';
import { iglesiasRouter } from './modules/iglesias/iglesias.routes';
import { criteriosRouter, objetosRouter } from './modules/patrimonio/patrimonio.routes';
import { crearEspaciosPublicRouter } from './modules/espacios/espacios.public.routes';
import { espaciosRouter } from './modules/espacios/espacios.routes';
import { eventosRouter } from './modules/eventos/eventos.routes';
import { miembrosRouter } from './modules/miembros/miembros.routes';
import { misasRouter, padresRouter } from './modules/misas/misas.routes';
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
    // E2-05 (Nataly): catálogo del INEGI; la consulta es pública y la carga, de la Coordinación
    { prefijo: '/public', router: catalogosPublicoRouter },
    // E2-07, E2-11–E2-13 (Nataly): lista por estado, ficha, reconocidas y búsqueda (sin sesión)
    { prefijo: '/public', router: consultasPublicasRouter },
    // E2-10 (Nataly): criterios del índice, solo la Coordinación
    { prefijo: '/criterios-indice', router: criteriosRouter },
    { prefijo: '/catalogos', router: catalogosRouter },
    // E3-06 (Genaro): padres de todo el país (Coordinación) y búsqueda para asociarlos
    { prefijo: '/padres', router: padresRouter },
    // Ecclesia: datos internos de una iglesia; cada ruta pasa por alcanceIglesia
    { prefijo: '/iglesias/:iglesiaId', router: misasRouter },
    { prefijo: '/iglesias/:iglesiaId', router: diezmoRouter },
    // E2-08 (Nataly): objetos del patrimonio e índice de la iglesia
    { prefijo: '/iglesias/:iglesiaId', router: objetosRouter },
    { prefijo: '/iglesias/:iglesiaId', router: espaciosRouter },
    // Espacios: solicitudes sin cuenta, con folio y clave (E4-08 a E4-11)
    { prefijo: '/public', router: crearEspaciosPublicRouter() },
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
