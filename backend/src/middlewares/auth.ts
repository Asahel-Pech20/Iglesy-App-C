import type { Request, RequestHandler } from 'express';
import { type Permiso, type RolUsuario, tienePermiso } from '../config/permisos';
import { AppError } from '../lib/appError';
import { prisma } from '../lib/prisma';
import { verificarAccessToken } from '../lib/seguridad';

/**
 * Valida el Bearer y carga req.usuario. Consulta la BD para que un usuario
 * desactivado o con rol cambiado no siga operando con un token viejo.
 */
export const autenticar: RequestHandler = async function autenticar(req, _res, next) {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith('Bearer ')) throw AppError.noAutenticado();
  const { sub } = verificarAccessToken(cabecera.slice(7));
  const usuario = await prisma.usuario.findUnique({
    where: { id: sub },
    select: { id: true, nombre: true, email: true, rol: true, iglesiaId: true, activo: true },
  });
  if (!usuario?.activo) throw AppError.noAutenticado();
  req.usuario = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    iglesiaId: usuario.iglesiaId,
  };
  next();
};

/** Usuario autenticado de la petición (para controllers detrás de `autenticar`). */
export function usuarioDe(req: Request) {
  if (!req.usuario) throw AppError.noAutenticado();
  return req.usuario;
}

/**
 * Exige TODOS los permisos indicados → 403 FORBIDDEN si falta alguno.
 * @example router.post('/', autenticar, autorizar('miembros:crear'), controller.crear)
 */
export function autorizar(...permisos: Permiso[]): RequestHandler {
  return function autorizar(req, _res, next) {
    const rol = usuarioDe(req).rol;
    if (!permisos.every((p) => tienePermiso(rol, p))) throw AppError.prohibido();
    next();
  };
}

/**
 * Exige AL MENOS UNO de los permisos. Útil para las variantes "-propio":
 * @example autorizarAlguno('eventos:crear', 'eventos:crear-propio') y luego, en el service,
 *          si solo tiene el "-propio", verificar esCoordinadorDe(usuario.id, ministerioId).
 */
export function autorizarAlguno(...permisos: Permiso[]): RequestHandler {
  return function autorizar(req, _res, next) {
    const rol = usuarioDe(req).rol;
    if (!permisos.some((p) => tienePermiso(rol, p))) throw AppError.prohibido();
    next();
  };
}

/** ¿El usuario coordina ese ministerio? Para las reglas de "propio" (B2, B3). */
export async function esCoordinadorDe(usuarioId: string, ministerioId: string) {
  const vinculo = await prisma.ministerioCoordinador.findUnique({
    where: { ministerioId_usuarioId: { ministerioId, usuarioId } },
    select: { usuarioId: true },
  });
  return vinculo !== null;
}

/** true si el rol tiene el permiso completo (sin restricción de "propio"). */
export function tieneAccesoCompleto(rol: RolUsuario, permiso: Permiso) {
  return tienePermiso(rol, permiso);
}
