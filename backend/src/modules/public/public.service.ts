/**
 * Cartelera pública (B3-15): solo datos públicos. No incluye miembros, usuarios (autores),
 * responsables ni datos internos de eventos y anuncios.
 */
import * as anunciosService from '../anuncios/anuncios.service';
import * as configuracionService from '../configuracion/configuracion.service';
import * as eventosService from '../eventos/eventos.service';

const MAX_ELEMENTOS = 10;
export const CACHE_MS = 60_000;

/**
 * E1-06: la cartelera muestra la gestión interna de la iglesia INICIAL, fijada aquí de forma
 * explícita (no hay sesión). E1-06b la vuelve una por iglesia, dentro de su ficha pública.
 */
export async function cartelera() {
  const [config, [horarios, anuncios, eventos]] = await Promise.all([
    configuracionService.obtener(),
    configuracionService.enIglesiaInicial(
      () =>
        Promise.all([
          configuracionService.listarHorarios(),
          anunciosService.vigentes({ limit: MAX_ELEMENTOS }),
          eventosService.proximos(MAX_ELEMENTOS),
        ]),
      [[], [], []] as const,
    ),
  ]);
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

type Cartelera = Awaited<ReturnType<typeof cartelera>>;

/** Cache en memoria de 60 s; una por instancia de la app (cada prueba arranca vacía). */
export function crearCacheCartelera(duracionMs = CACHE_MS) {
  let guardada: { datos: Cartelera; expira: number } | null = null;
  return async function obtenerCartelera() {
    const ahora = Date.now();
    if (guardada && guardada.expira > ahora) return guardada.datos;
    const datos = await cartelera();
    guardada = { datos, expira: ahora + duracionMs };
    return datos;
  };
}
