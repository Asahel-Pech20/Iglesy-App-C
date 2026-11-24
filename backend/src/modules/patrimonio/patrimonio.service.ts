// Patrimonio (E2-08 y E2-10, Nataly): objetos de cada iglesia, su estado y el índice patrimonial
// calculado con los criterios vigentes (RF-13–RF-18, RF-22, RN-01–RN-06, RN-10, RN-11, RN-14–RN-16).
import { partesLocales } from '../../lib/dominio/zona';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import * as iglesiasService from '../iglesias/iglesias.service';
import {
  CRITERIOS_INICIALES,
  GRUPO_DE_TIPO,
  aObjetoDelIndice,
  antiguedad,
  epoca,
  indiceIglesia,
  puntosObjeto,
  type CriteriosIndice,
  type EstadoObjeto,
  type TipoObjetoCaptura,
} from './dominio/indice-patrimonial';
import type {
  CambiarEstadoObjeto,
  CrearObjeto,
  Criterios,
  EditarObjeto,
  QueryHistorialCriterios,
  QueryListarObjetos,
} from './patrimonio.schemas';

/** RN-15: año de cálculo = año en curso en la zona de la iglesia (supuesto mientras no responda P-01). */
export function anioDeCalculo(zonaHoraria: string, ahora = new Date()) {
  return partesLocales(ahora, zonaHoraria).anio;
}

/** Hoy (`yyyy-MM-dd`) en la zona de la iglesia. */
function hoyEn(zonaHoraria: string) {
  const { anio, mes, dia } = partesLocales(new Date(), zonaHoraria);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ───────────── Criterios del índice (E2-10, RF-22, RN-14) ─────────────

const SELECT_CRITERIOS = {
  id: true,
  rangosEdad: true,
  multiplicadores: true,
  puntosInah: true,
  distinciones: true,
  createdAt: true,
  creadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.CriteriosIndiceSelect;

type FilaCriterios = Prisma.CriteriosIndiceGetPayload<{ select: typeof SELECT_CRITERIOS }>;

function aCriterios(fila: FilaCriterios): CriteriosIndice {
  return {
    rangosEdad: fila.rangosEdad as CriteriosIndice['rangosEdad'],
    multiplicadores: fila.multiplicadores as CriteriosIndice['multiplicadores'],
    puntosInah: fila.puntosInah.toNumber(),
    distinciones: fila.distinciones as CriteriosIndice['distinciones'],
  };
}

function formatearVersion(fila: FilaCriterios) {
  return {
    ...aCriterios(fila),
    id: fila.id,
    vigenteDesde: fila.createdAt.toISOString(),
    creadoPor: fila.creadoPor,
  };
}

/** Los criterios vigentes: la versión más reciente o, si nunca se han cambiado, los del caso. */
export async function criteriosVigentes(): Promise<CriteriosIndice> {
  const fila = await prisma.criteriosIndice.findFirst({
    select: SELECT_CRITERIOS,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return fila ? aCriterios(fila) : CRITERIOS_INICIALES;
}

/** GET /criterios-indice: los vigentes con su versión (null = los iniciales del caso). */
export async function obtenerCriterios() {
  const fila = await prisma.criteriosIndice.findFirst({
    select: SELECT_CRITERIOS,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return fila
    ? formatearVersion(fila)
    : { ...CRITERIOS_INICIALES, id: null, vigenteDesde: null, creadoPor: null };
}

/** PUT /criterios-indice: guarda una versión nueva; el índice de todas las iglesias cambia (RN-14). */
export async function guardarCriterios(datos: Criterios, usuarioId: string) {
  const fila = await prisma.criteriosIndice.create({
    data: {
      rangosEdad: datos.rangosEdad,
      multiplicadores: datos.multiplicadores,
      puntosInah: datos.puntosInah.toFixed(1),
      distinciones: datos.distinciones,
      creadoPorId: usuarioId,
    },
    select: SELECT_CRITERIOS,
  });
  return formatearVersion(fila);
}

export async function historialCriterios(query: QueryHistorialCriterios) {
  const { page, limit, skip, take } = paginar(query);
  const [total, filas] = await Promise.all([
    prisma.criteriosIndice.count(),
    prisma.criteriosIndice.findMany({
      select: SELECT_CRITERIOS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
  ]);
  return { datos: filas.map(formatearVersion), meta: crearMeta(total, page, limit) };
}

// ───────────── Objetos (E2-08, RF-13–RF-17) ─────────────

const SELECT_OBJETO = {
  id: true,
  descripcion: true,
  tipo: true,
  anio: true,
  siglo: true,
  material: true,
  estadoConservacion: true,
  ubicacionEnTemplo: true,
  catalogadoInah: true,
  estado: true,
  fechaEstado: true,
  motivoEstado: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ObjetoPatrimonialSelect;

type FilaObjeto = Prisma.ObjetoPatrimonialGetPayload<{ select: typeof SELECT_OBJETO }>;

/** Para el panel: datos completos, época (RF-17) y los puntos que aporta hoy (0 si no es vigente). */
function formatearObjeto(o: FilaObjeto, anioCalculo: number, criterios: CriteriosIndice) {
  const calculable = aObjetoDelIndice(o);
  return {
    ...o,
    fechaEstado: o.fechaEstado?.toISOString().slice(0, 10) ?? null,
    epoca: epoca(o),
    grupo: GRUPO_DE_TIPO[o.tipo],
    antiguedad: antiguedad(calculable, anioCalculo),
    puntos: o.estado === 'VIGENTE' ? puntosObjeto(calculable, anioCalculo, criterios) : 0,
  };
}

async function contexto(iglesiaId: string) {
  const [iglesia, criterios] = await Promise.all([
    iglesiasService.obtener(iglesiaId),
    criteriosVigentes(),
  ]);
  return { iglesia, criterios, anioCalculo: anioDeCalculo(iglesia.zonaHoraria) };
}

/** RF-14, RF-15: todos los objetos de la iglesia, de cualquier estado, con sus puntos. */
export async function listarObjetos(iglesiaId: string, query: QueryListarObjetos) {
  const { page, limit, skip, take } = paginar(query);
  const where: Prisma.ObjetoPatrimonialWhereInput = {
    iglesiaId,
    ...(query.estado && { estado: query.estado }),
    ...(query.tipo && { tipo: query.tipo }),
  };
  const [{ criterios, anioCalculo }, total, filas] = await Promise.all([
    contexto(iglesiaId),
    prisma.objetoPatrimonial.count({ where }),
    prisma.objetoPatrimonial.findMany({
      where,
      select: SELECT_OBJETO,
      orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
  ]);
  return {
    datos: filas.map((o) => formatearObjeto(o, anioCalculo, criterios)),
    meta: crearMeta(total, page, limit),
  };
}

/** RF-13, RN-10: el año no puede ser futuro (la antigüedad sería negativa). */
function validarAnio(anio: number | null | undefined, anioCalculo: number) {
  if (anio !== null && anio !== undefined && anio > anioCalculo)
    throw AppError.validacion('El año no puede ser futuro.', [
      { campo: 'anio', mensaje: 'El año no puede ser futuro.' },
    ]);
}

export async function crearObjeto(iglesiaId: string, datos: CrearObjeto) {
  const { criterios, anioCalculo } = await contexto(iglesiaId);
  validarAnio(datos.anio, anioCalculo);
  const creado = await prisma.objetoPatrimonial.create({
    data: { ...datos, anio: datos.anio ?? null, siglo: datos.siglo ?? null, iglesiaId },
    select: SELECT_OBJETO,
  });
  return formatearObjeto(creado, anioCalculo, criterios);
}

async function objetoDe(iglesiaId: string, objetoId: string) {
  const objeto = await prisma.objetoPatrimonial.findFirst({
    where: { id: objetoId, iglesiaId },
    select: SELECT_OBJETO,
  });
  // Un objeto de otra iglesia responde igual que uno que no existe
  if (!objeto) throw AppError.noEncontrado('El objeto no existe.');
  return objeto;
}

/** RF-14. Igual que en iglesias (A2-E2-01): año y siglo se validan contra lo ya guardado. */
export async function editarObjeto(iglesiaId: string, objetoId: string, cambios: EditarObjeto) {
  const [{ criterios, anioCalculo }, actual] = await Promise.all([
    contexto(iglesiaId),
    objetoDe(iglesiaId, objetoId),
  ]);
  if (actual.estado === 'BAJA')
    throw AppError.reglaNegocio('El objeto está dado de baja; ya no se edita.');
  const anio = cambios.anio !== undefined ? cambios.anio : actual.anio;
  const siglo = cambios.siglo !== undefined ? cambios.siglo : actual.siglo;
  if (anio === null && siglo === null)
    throw AppError.validacion('Escribe el año o, si no se conoce, el siglo.', [
      { campo: 'anio', mensaje: 'Escribe el año o, si no se conoce, el siglo.' },
    ]);
  if (anio !== null && siglo !== null && Math.ceil(anio / 100) !== siglo)
    throw AppError.validacion('El año no es de ese siglo.', [
      { campo: 'siglo', mensaje: 'El año no es de ese siglo.' },
    ]);
  validarAnio(cambios.anio, anioCalculo);
  const editado = await prisma.objetoPatrimonial.update({
    where: { id: objetoId },
    data: cambios,
    select: SELECT_OBJETO,
  });
  return formatearObjeto(editado, anioCalculo, criterios);
}

/**
 * Transiciones permitidas (RF-15, RN-11). VIGENTE → PERDIDO, PRESTADO o BAJA; un objeto prestado o
 * perdido puede regresar (VIGENTE, supuesto de P-08) o darse de baja; la BAJA es definitiva.
 */
const TRANSICIONES: Record<EstadoObjeto, readonly EstadoObjeto[]> = {
  VIGENTE: ['PERDIDO', 'PRESTADO', 'BAJA'],
  PRESTADO: ['VIGENTE', 'BAJA'],
  PERDIDO: ['VIGENTE', 'BAJA'],
  BAJA: [],
};

export function puedeCambiar(de: EstadoObjeto, a: EstadoObjeto) {
  return TRANSICIONES[de].includes(a);
}

export async function cambiarEstadoObjeto(
  iglesiaId: string,
  objetoId: string,
  { estado, fecha, motivo }: CambiarEstadoObjeto,
) {
  const [{ iglesia, criterios, anioCalculo }, actual] = await Promise.all([
    contexto(iglesiaId),
    objetoDe(iglesiaId, objetoId),
  ]);
  if (!puedeCambiar(actual.estado, estado))
    throw AppError.reglaNegocio(
      actual.estado === 'BAJA'
        ? 'El objeto está dado de baja; su estado ya no cambia.'
        : `Un objeto ${actual.estado.toLowerCase()} no puede pasar a ${estado.toLowerCase()}.`,
    );
  if (fecha > hoyEn(iglesia.zonaHoraria))
    throw AppError.validacion('La fecha no puede ser futura.', [
      { campo: 'fecha', mensaje: 'La fecha no puede ser futura.' },
    ]);
  const cambiado = await prisma.objetoPatrimonial.update({
    where: { id: objetoId },
    data: { estado, fechaEstado: new Date(`${fecha}T00:00:00.000Z`), motivoEstado: motivo },
    select: SELECT_OBJETO,
  });
  return formatearObjeto(cambiado, anioCalculo, criterios);
}

// ───────────── Índice para otras consultas (E2-10, E2-11–E2-13) ─────────────

const SELECT_CALCULO = {
  iglesiaId: true,
  tipo: true,
  anio: true,
  siglo: true,
  catalogadoInah: true,
  estado: true,
} satisfies Prisma.ObjetoPatrimonialSelect;

export interface IndiceDeIglesia {
  indice: number;
  distincion: string | null;
  anioCalculo: number;
  /** Objetos registrados de cualquier estado (RN-13: sin ninguno, no entra al ranking). */
  objetosRegistrados: number;
  objetosVigentes: number;
}

/**
 * RF-18, RN-14: índice y distinción de varias iglesias con los criterios vigentes, cada una con el
 * año de cálculo de su zona. Una iglesia sin objetos tiene índice 0 y sin distinción.
 */
export async function indicesDe(
  iglesias: { id: string; zonaHoraria: string }[],
  criterios?: CriteriosIndice,
): Promise<Map<string, IndiceDeIglesia>> {
  const vigentes = criterios ?? (await criteriosVigentes());
  const objetos = iglesias.length
    ? await prisma.objetoPatrimonial.findMany({
        where: { iglesiaId: { in: iglesias.map((i) => i.id) } },
        select: SELECT_CALCULO,
      })
    : [];
  const porIglesia = new Map<string, typeof objetos>();
  for (const o of objetos) porIglesia.set(o.iglesiaId, [...(porIglesia.get(o.iglesiaId) ?? []), o]);
  const resultado = new Map<string, IndiceDeIglesia>();
  for (const iglesia of iglesias) {
    const propios = porIglesia.get(iglesia.id) ?? [];
    const anioCalculo = anioDeCalculo(iglesia.zonaHoraria);
    resultado.set(iglesia.id, {
      ...indiceIglesia(propios.map(aObjetoDelIndice), anioCalculo, vigentes),
      anioCalculo,
      objetosRegistrados: propios.length,
      objetosVigentes: propios.filter((o) => o.estado === 'VIGENTE').length,
    });
  }
  return resultado;
}

/** GET /iglesias/:iglesiaId/indice: el índice de una iglesia para el panel. */
export async function indiceDeIglesia(iglesiaId: string) {
  const iglesia = await iglesiasService.obtener(iglesiaId);
  const indices = await indicesDe([iglesia]);
  return indices.get(iglesia.id) as IndiceDeIglesia;
}

/**
 * RF-16: objetos VIGENTES de una iglesia para el público. Sin la ubicación en el templo ni el
 * estado de conservación (supuesto mientras no responda P-05).
 */
export async function objetosPublicos(iglesiaId: string) {
  const filas = await prisma.objetoPatrimonial.findMany({
    where: { iglesiaId, estado: 'VIGENTE' },
    select: {
      id: true,
      descripcion: true,
      tipo: true,
      anio: true,
      siglo: true,
      material: true,
      catalogadoInah: true,
    },
    orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
  });
  return filas.map((o) => ({ ...o, epoca: epoca(o) }));
}

/**
 * RF-23: de las iglesias dadas, las que tienen al menos un objeto VIGENTE del tipo con la
 * antigüedad mínima, y cuáles objetos cumplen (supuesto de P-09: un tipo y un mínimo).
 */
export async function iglesiasConObjeto(
  iglesias: { id: string; zonaHoraria: string }[],
  tipo: TipoObjetoCaptura,
  antiguedadMin: number,
) {
  const candidatos = iglesias.length
    ? await prisma.objetoPatrimonial.findMany({
        where: { iglesiaId: { in: iglesias.map((i) => i.id) }, tipo, estado: 'VIGENTE' },
        select: { ...SELECT_CALCULO, id: true, descripcion: true },
        orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
      })
    : [];
  const zona = new Map(iglesias.map((i) => [i.id, i.zonaHoraria]));
  const cumplen = new Map<
    string,
    { id: string; descripcion: string; epoca: string; antiguedad: number }[]
  >();
  for (const o of candidatos) {
    const anios = antiguedad(aObjetoDelIndice(o), anioDeCalculo(zona.get(o.iglesiaId) as string));
    if (anios < antiguedadMin) continue;
    const lista = cumplen.get(o.iglesiaId) ?? [];
    lista.push({ id: o.id, descripcion: o.descripcion, epoca: epoca(o), antiguedad: anios });
    cumplen.set(o.iglesiaId, lista);
  }
  return cumplen;
}
