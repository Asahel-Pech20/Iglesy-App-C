// Consultas públicas (E2-07, E2-11–E2-13, Nataly). Reúne los services de iglesias y patrimonio:
// lista por estado con su distinción, ficha, iglesias reconocidas y búsqueda del investigador.
// Nunca devuelve iglesias cerradas (RN-07) ni objetos que no estén vigentes (RN-11).
import { crearMeta, paginar } from '../../lib/paginacion';
import * as espaciosService from '../espacios/espacios.service';
import * as iglesiasService from '../iglesias/iglesias.service';
import * as horarioMisasService from '../misas/horario.service';
import * as serviciosService from '../servicios/servicios.service';
import * as patrimonioService from '../patrimonio/patrimonio.service';
import type {
  QueryBusquedaPatrimonio,
  QueryListaPublica,
  QueryReconocidas,
} from './consultas.schemas';
import { ordenarRanking } from './dominio/ranking';

/** Quita la zona horaria (solo sirve para el año de cálculo) de lo que ve el visitante. */
function sinZona<T extends { zonaHoraria: string }>({ zonaHoraria: _zona, ...resto }: T) {
  return resto;
}

/** E2-07 + RF-18 (CA-02): la lista del estado con el índice y la distinción de cada iglesia. */
export async function listaPorEstado(query: QueryListaPublica) {
  const { datos, meta } = await iglesiasService.listarPublicas(query);
  const indices = await patrimonioService.indicesDe(datos);
  return {
    datos: datos.map((i) => {
      const { indice, distincion } = indices.get(i.id) ?? { indice: 0, distincion: null };
      return { ...sinZona(i), indice, distincion };
    }),
    meta,
  };
}

/**
 * E2-11 (RF-06, RF-16, RF-18, CA-04): todo lo de una iglesia en una sola respuesta.
 * `tiposEspacio` viene del service de Oscar (E4-08, sin precios). `misas` es el horario semanal con su
 * padre (Genaro, E3-10); `servicios` y `platicas` también son de Genaro (E3-12, E3-14).
 */
export async function ficha(iglesiaId: string) {
  const iglesia = await iglesiasService.obtenerPublica(iglesiaId);
  const [indices, objetos, espacios, misas, servicios, platicas] = await Promise.all([
    patrimonioService.indicesDe([iglesia]),
    patrimonioService.objetosPublicos(iglesia.id),
    espaciosService.tiposPublicos(iglesia.id),
    horarioMisasService.horarioPublico(iglesia.id),
    serviciosService.serviciosPublicos(iglesia.id),
    serviciosService.platicasPublicas(iglesia.id),
  ]);
  const { indice, distincion, anioCalculo } = indices.get(iglesia.id) as {
    indice: number;
    distincion: string | null;
    anioCalculo: number;
  };
  return {
    ...sinZona(iglesia),
    indice,
    distincion,
    anioCalculo,
    objetos,
    servicios,
    platicas,
    misas,
    tiposEspacio: espacios.tipos,
  };
}

/** E2-12: el ranking completo (sin paginar) de las iglesias activas de un lugar. */
async function calcularRanking(lugar: iglesiasService.LugarPublico) {
  const iglesias = await iglesiasService.activasDelLugar(lugar);
  const indices = await patrimonioService.indicesDe(iglesias);
  return ordenarRanking(
    iglesias.map((i) => {
      const calculo = indices.get(i.id);
      return {
        ...sinZona(i),
        indice: calculo?.indice ?? 0,
        distincion: calculo?.distincion ?? null,
        objetosRegistrados: calculo?.objetosRegistrados ?? 0,
        objetosVigentes: calculo?.objetosVigentes ?? 0,
      };
    }),
  );
}

type Ranking = Awaited<ReturnType<typeof calcularRanking>>;

/** E2-19: una entrada vale a lo más 60 s (así también se nota el cambio de año de RN-15). */
export const CACHE_RANKING_MS = 60_000;
/** Lugares guardados a la vez; al pasarse se descarta el más antiguo. */
const MAX_LUGARES = 500;

/**
 * E2-19: caché en memoria del ranking por lugar. Una entrada sirve mientras no caduque y la huella
 * no cambie: registrar, editar o cambiar el estado de un objeto, guardar criterios o editar o cerrar
 * una iglesia la invalidan al instante. Mismo esquema que el caché del dashboard (B4-08).
 */
export function crearCacheRanking(duracionMs = CACHE_RANKING_MS) {
  const guardados = new Map<string, { ranking: Ranking; huella: string; expira: number }>();
  return async function rankingDe(lugar: iglesiasService.LugarPublico): Promise<Ranking> {
    const clave = [lugar.estado, lugar.municipio, lugar.localidad].join('|');
    const [indice, iglesias] = await Promise.all([
      patrimonioService.huellaIndice(),
      iglesiasService.huellaIglesias(),
    ]);
    const huella = `${indice}|${iglesias}`;
    const ahora = Date.now();
    const guardado = guardados.get(clave);
    if (guardado && guardado.expira > ahora && guardado.huella === huella) return guardado.ranking;
    const ranking = await calcularRanking(lugar);
    guardados.delete(clave);
    const masAntiguo = guardados.keys().next();
    if (guardados.size >= MAX_LUGARES && !masAntiguo.done) guardados.delete(masAntiguo.value);
    guardados.set(clave, { ranking, huella, expira: ahora + duracionMs });
    return ranking;
  };
}

const rankingCompartido = crearCacheRanking();

/** E2-12 (RF-19–RF-21, RN-12, RN-13, CA-06): de mayor a menor índice, con su posición. */
export async function reconocidas(query: QueryReconocidas, rankingDe = rankingCompartido) {
  const { page, limit, skip } = paginar(query);
  const ranking = await rankingDe(query);
  return {
    datos: ranking
      .slice(skip, skip + limit)
      .map(({ objetosRegistrados: _r, objetosVigentes: _v, ...i }, n) => ({
        posicion: skip + n + 1,
        ...i,
      })),
    meta: crearMeta(ranking.length, page, limit),
  };
}

/**
 * E2-13 (RF-23, CA-08): iglesias activas del lugar con al menos un objeto vigente del tipo y la
 * antigüedad pedidos, con los objetos que cumplen (supuesto de P-09). Ordenadas por nombre.
 */
export async function busquedaPatrimonio(query: QueryBusquedaPatrimonio) {
  const { page, limit, skip } = paginar(query);
  const iglesias = await iglesiasService.activasDelLugar(query);
  const cumplen = await patrimonioService.iglesiasConObjeto(
    iglesias,
    query.tipoObjeto,
    query.antiguedadMin,
  );
  const encontradas = iglesias.filter((i) => cumplen.has(i.id));
  const pagina = encontradas.slice(skip, skip + limit);
  const indices = await patrimonioService.indicesDe(pagina);
  return {
    datos: pagina.map((i) => ({
      ...sinZona(i),
      indice: indices.get(i.id)?.indice ?? 0,
      distincion: indices.get(i.id)?.distincion ?? null,
      objetos: cumplen.get(i.id) ?? [],
    })),
    meta: crearMeta(encontradas.length, page, limit),
  };
}
