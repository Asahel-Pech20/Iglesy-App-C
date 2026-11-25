// Consultas públicas (E2-07, E2-11–E2-13, Nataly). Reúne los services de iglesias y patrimonio:
// lista por estado con su distinción, ficha, iglesias reconocidas y búsqueda del investigador.
// Nunca devuelve iglesias cerradas (RN-07) ni objetos que no estén vigentes (RN-11).
import { crearMeta, paginar } from '../../lib/paginacion';
import * as espaciosService from '../espacios/espacios.service';
import * as iglesiasService from '../iglesias/iglesias.service';
import * as horarioMisasService from '../misas/horario.service';
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
 * padre (Genaro, E3-10). `servicios` y `platicas` (Genaro, E3-12 y E3-14) siguen vacíos hasta que existan.
 */
export async function ficha(iglesiaId: string) {
  const iglesia = await iglesiasService.obtenerPublica(iglesiaId);
  const [indices, objetos, espacios, misas] = await Promise.all([
    patrimonioService.indicesDe([iglesia]),
    patrimonioService.objetosPublicos(iglesia.id),
    espaciosService.tiposPublicos(iglesia.id),
    horarioMisasService.horarioPublico(iglesia.id),
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
    servicios: [],
    platicas: [],
    misas,
    tiposEspacio: espacios.tipos,
  };
}

/** E2-12 (RF-19–RF-21, RN-12, RN-13, CA-06): de mayor a menor índice, con su posición. */
export async function reconocidas(query: QueryReconocidas) {
  const { page, limit, skip } = paginar(query);
  const iglesias = await iglesiasService.activasDelLugar(query);
  const indices = await patrimonioService.indicesDe(iglesias);
  const ranking = ordenarRanking(
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
