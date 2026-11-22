/**
 * Cartelera pública (B3-15): solo datos públicos. No incluye miembros, usuarios (autores),
 * responsables ni datos internos de eventos y anuncios.
 */
import { AppError } from '../../lib/appError';
import { conIglesia } from '../../lib/contextoIglesia';
import * as anunciosService from '../anuncios/anuncios.service';
import * as configuracionService from '../configuracion/configuracion.service';
import * as eventosService from '../eventos/eventos.service';

const MAX_ELEMENTOS = 10;
export const CACHE_MS = 60_000;

/**
 * Cartelera de la iglesia del CONTEXTO (E1-06b): sus datos, horarios, anuncios y eventos.
 * Quien la llama fija la iglesia (`carteleraDe` o `carteleraInicial`); no hay sesión.
 */
async function armarCartelera() {
  const [config, horarios, anuncios, eventos] = await Promise.all([
    configuracionService.obtener(),
    configuracionService.listarHorarios(),
    anunciosService.vigentes({ limit: MAX_ELEMENTOS }),
    eventosService.proximos(MAX_ELEMENTOS),
  ]);
  return aCartelera(config, horarios, anuncios, eventos);
}

function aCartelera(
  config: configuracionService.Configuracion,
  horarios: Awaited<ReturnType<typeof configuracionService.listarHorarios>>,
  anuncios: Awaited<ReturnType<typeof anunciosService.vigentes>>,
  eventos: Awaited<ReturnType<typeof eventosService.proximos>>,
) {
  return {
    iglesia: {
      nombre: config.nombre,
      logoUrl: config.logoUrl,
      direccion: config.direccion,
      ciudad: config.ciudad,
      telefono: config.telefono,
      email: config.email,
      sitioWeb: config.sitioWeb,
    },
    horarios: horarios
      .filter((h) => h.activo)
      .map(({ id, nombre, diaSemana, horaInicio, horaFin, lugar }) => ({
        id,
        nombre,
        diaSemana,
        horaInicio,
        horaFin,
        lugar,
      })),
    anuncios: anuncios.map(
      ({ id, titulo, contenido, prioridad, fechaPublicacion, fechaExpiracion }) => ({
        id,
        titulo,
        contenido,
        prioridad,
        fechaPublicacion,
        fechaExpiracion,
      }),
    ),
    eventosProximos: eventos.map(
      ({ id, titulo, descripcion, tipo, categoria, fechaInicio, fechaFin, lugar }) => ({
        id,
        titulo,
        descripcion,
        tipo,
        categoria,
        fechaInicio,
        fechaFin,
        lugar,
      }),
    ),
  };
}

type Cartelera = ReturnType<typeof aCartelera>;

/** Cartelera de una iglesia (E1-06b). 404 si no existe o está cerrada (no aparece en lo público). */
export async function carteleraDe(iglesiaId: string): Promise<Cartelera> {
  if (!(await configuracionService.esIglesiaPublica(iglesiaId))) {
    throw AppError.noEncontrado('La iglesia no existe.');
  }
  return conIglesia(iglesiaId, armarCartelera);
}

/** `/public/cartelera` (alias heredado de AppIglesia): la de la iglesia inicial, explícita. */
export async function carteleraInicial(): Promise<Cartelera> {
  const iglesiaId = await configuracionService.iglesiaInicial();
  if (!iglesiaId) {
    return aCartelera(configuracionService.CONFIGURACION_SIN_IGLESIAS, [], [], []);
  }
  return conIglesia(iglesiaId, armarCartelera);
}

/**
 * Cache en memoria de 60 s POR IGLESIA (la llave es la iglesia; `inicial` para el alias); una
 * por instancia de la app (cada prueba arranca vacía).
 */
export function crearCacheCartelera(duracionMs = CACHE_MS) {
  const guardadas = new Map<string, { datos: Cartelera; expira: number }>();
  return async function obtenerCartelera(iglesiaId?: string) {
    const llave = iglesiaId ?? 'inicial';
    const ahora = Date.now();
    const guardada = guardadas.get(llave);
    if (guardada && guardada.expira > ahora) return guardada.datos;
    const datos = iglesiaId ? await carteleraDe(iglesiaId) : await carteleraInicial();
    guardadas.set(llave, { datos, expira: ahora + duracionMs });
    return datos;
  };
}
