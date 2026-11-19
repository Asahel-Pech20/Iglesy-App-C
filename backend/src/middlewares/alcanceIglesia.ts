// Alcance por iglesia (ADR-0004, RNF-10, RF-82, RN-54). Base de Oscar + E1-01 de Santiago.
// La iglesia del recurso se obtiene SIEMPRE de la BD; la del usuario, de su sesión (que también
// viene de la BD en `autenticar`). Nunca se confía en una iglesiaId enviada en body, query o cabeceras.
import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/appError';
import { prisma } from '../lib/prisma';
import { usuarioDe } from './auth';

/** Devuelve la iglesia dueña del recurso, leída de la BD; null o undefined si el recurso no existe. */
export type ResolverIglesia = (req: Request) => Promise<string | null | undefined>;

export type ResultadoAlcance = 'PERMITIDO' | 'NO_EXISTE' | 'PROHIBIDO';

/** Qué hace la Coordinación (rol nacional, sin iglesia) en una ruta de iglesia. */
export type ReglaCoordinacion = 'permitir' | 'denegar';

/**
 * Supuestos mientras el cliente responde P-21 y P-28 (supuesto S-02 de docs/ecclesia/plan-santiago.md).
 * NO son reglas del cliente. Úsalos en vez de escribir 'permitir'/'denegar' a mano, para poder
 * cambiarlos en un solo lugar cuando llegue la respuesta.
 */
export const SUPUESTOS_ALCANCE = {
  /** Datos de la iglesia, objetos, servicios, misas…: la Coordinación entra (RF-07, RF-08). */
  datosIglesia: 'permitir',
  /** Diezmo y solicitudes de espacio: solo el personal de esa iglesia (RF-82, RN-54; P-21, P-28). */
  datosPrivados: 'denegar',
} as const satisfies Record<string, ReglaCoordinacion>;

/**
 * Regla pura del alcance por iglesia (ADR-0004, RNF-10): el personal solo entra a recursos de su
 * propia iglesia. La Coordinación (sin iglesia) entra solo si la ruta lo permite; por omisión, no.
 */
export function evaluarAlcance(
  iglesiaDelUsuario: string | null,
  iglesiaDelRecurso: string | null | undefined,
  coordinacion: ReglaCoordinacion = 'denegar',
): ResultadoAlcance {
  if (iglesiaDelRecurso === null || iglesiaDelRecurso === undefined) return 'NO_EXISTE';
  if (iglesiaDelUsuario === null) return coordinacion === 'permitir' ? 'PERMITIDO' : 'PROHIBIDO';
  return iglesiaDelUsuario === iglesiaDelRecurso ? 'PERMITIDO' : 'PROHIBIDO';
}

/**
 * Exige que el recurso pertenezca a la iglesia del usuario. La iglesia del recurso se lee de la BD
 * con `resolver`; nunca se confía en una `iglesiaId` enviada por el cliente.
 * 404 si el recurso no existe y 403 si es de otra iglesia. Va después de `autenticar`.
 * La Coordinación recibe 403 salvo que la ruta indique `coordinacion: SUPUESTOS_ALCANCE.datosIglesia`.
 * Si pasa, la iglesia verificada queda en `req.iglesiaAlcance` (ver `iglesiaAlcanceDe`).
 * @example router.use('/iglesias/:iglesiaId', autenticar, alcanceIglesia(iglesiaDeLaRuta))
 * @example alcanceIglesia(iglesiaDeLaRuta, { coordinacion: SUPUESTOS_ALCANCE.datosIglesia })
 */
export function alcanceIglesia(
  resolver: ResolverIglesia,
  opciones: { coordinacion?: ReglaCoordinacion } = {},
): RequestHandler {
  return async function alcanceIglesia(req, _res, next) {
    const usuario = usuarioDe(req);
    const iglesiaDelRecurso = await resolver(req);
    const resultado = evaluarAlcance(usuario.iglesiaId, iglesiaDelRecurso, opciones.coordinacion);
    if (resultado === 'NO_EXISTE') throw AppError.noEncontrado('La iglesia no existe.');
    if (resultado === 'PROHIBIDO') throw AppError.prohibido();
    req.iglesiaAlcance = iglesiaDelRecurso ?? undefined;
    next();
  };
}

/** Resolver para rutas `/iglesias/:iglesiaId/...`: la iglesia del parámetro, si existe en la BD. */
export const iglesiaDeLaRuta: ResolverIglesia = async (req) => {
  const id = req.params['iglesiaId'];
  if (typeof id !== 'string' || id === '') return undefined;
  const iglesia = await prisma.iglesia.findUnique({ where: { id }, select: { id: true } });
  return iglesia?.id;
};

/** Iglesia verificada por `alcanceIglesia` (para controllers que van detrás de él). */
export function iglesiaAlcanceDe(req: Request): string {
  if (!req.iglesiaAlcance) throw AppError.prohibido();
  return req.iglesiaAlcance;
}

/**
 * Iglesia del usuario para CREAR recursos de su iglesia cuando no hay `:iglesiaId` en la ruta.
 * Nunca uses una iglesiaId del body. La Coordinación no tiene iglesia → 403.
 */
export function iglesiaDe(req: Request): string {
  const { iglesiaId } = usuarioDe(req);
  if (!iglesiaId) throw AppError.prohibido('Esta acción es del personal de una iglesia.');
  return iglesiaId;
}
