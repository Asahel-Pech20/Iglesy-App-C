// Servicios y pláticas de una iglesia (E3-11 a E3-14, Genaro). El personal de una iglesia solo
// modifica los de la suya (RN-32, por alcanceIglesia); el público los consulta sin cuenta (RN-33).
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { prisma } from '../../lib/prisma';
import * as iglesiasService from '../iglesias/iglesias.service';
import * as padresService from '../misas/padres.service';
import {
  errorDeCosto,
  type ActualizarPlatica,
  type ActualizarServicio,
  type CrearPlatica,
  type CrearServicio,
  type Horario,
  type QueryPlaticasDelMunicipio,
  type QueryPlaticasPublicas,
} from './servicios.schemas';

// Mutable a propósito: Prisma no acepta un arreglo de solo lectura en `orderBy`
const ORDEN_HORARIOS: { diaSemana?: 'asc'; hora?: 'asc' }[] = [
  { diaSemana: 'asc' },
  { hora: 'asc' },
];
const SELECT_HORARIO = { diaSemana: true, hora: true } as const;

const dinero = (d: { toFixed(n: number): string } | null) => (d === null ? null : d.toFixed(2));

// ───────────── Servicios (RF-30–RF-35) ─────────────

const SELECT_SERVICIO = {
  id: true,
  nombre: true,
  formaCosto: true,
  monto: true,
  requisitos: true,
  duracionMin: true,
  requiereCita: true,
  horarios: { orderBy: ORDEN_HORARIOS, select: SELECT_HORARIO },
} as const;

type ServicioLeido = {
  id: string;
  nombre: string;
  formaCosto: string;
  monto: { toFixed(n: number): string } | null;
  requisitos: string | null;
  duracionMin: number | null;
  requiereCita: boolean;
  horarios: Horario[];
};

const aServicio = (s: ServicioLeido) => ({ ...s, monto: dinero(s.monto) });

function esNombreRepetido(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const errorServicioRepetido = () =>
  AppError.conflicto('La iglesia ya tiene un servicio con ese nombre.', [
    { campo: 'nombre', mensaje: 'Usa otro nombre o edita el servicio que ya existe.' },
  ]);

export async function listarServicios(iglesiaId: string) {
  const servicios = await prisma.servicio.findMany({
    where: { iglesiaId, activo: true },
    orderBy: { nombre: 'asc' },
    select: SELECT_SERVICIO,
  });
  return servicios.map(aServicio);
}

export async function crearServicio(iglesiaId: string, datos: CrearServicio) {
  try {
    const servicio = await prisma.servicio.create({
      data: {
        iglesiaId,
        nombre: datos.nombre,
        formaCosto: datos.formaCosto,
        monto: datos.monto ?? null,
        requisitos: datos.requisitos ?? null,
        duracionMin: datos.duracionMin ?? null,
        requiereCita: datos.requiereCita ?? false,
        horarios: { create: datos.horarios ?? [] },
      },
      select: SELECT_SERVICIO,
    });
    return aServicio(servicio);
  } catch (error) {
    if (esNombreRepetido(error)) throw errorServicioRepetido();
    throw error;
  }
}

async function servicioDeIglesia(iglesiaId: string, servicioId: string) {
  const actual = await prisma.servicio.findFirst({
    where: { id: servicioId, iglesiaId, activo: true },
    select: { formaCosto: true, monto: true },
  });
  if (!actual) throw AppError.noEncontrado('El servicio no existe en esta iglesia.');
  return actual;
}

/** Cambia los datos; si vienen `horarios`, reemplazan a los anteriores (RF-34). */
export async function actualizarServicio(
  iglesiaId: string,
  servicioId: string,
  cambios: ActualizarServicio,
) {
  const actual = await servicioDeIglesia(iglesiaId, servicioId);
  const formaCosto = cambios.formaCosto ?? actual.formaCosto;
  // Si cambia a gratuito sin decir el monto, el monto anterior se quita
  const monto =
    cambios.monto !== undefined
      ? cambios.monto
      : formaCosto === 'GRATUITO'
        ? null
        : dinero(actual.monto);
  const error = errorDeCosto(formaCosto, monto);
  if (error) throw AppError.validacion(error, [{ campo: 'monto', mensaje: error }]);

  const { horarios, ...datos } = cambios;
  try {
    const servicio = await prisma.$transaction(async (tx) => {
      if (horarios) {
        await tx.horarioServicio.deleteMany({ where: { servicioId } });
        await tx.horarioServicio.createMany({
          data: horarios.map((h) => ({ ...h, servicioId })),
        });
      }
      return tx.servicio.update({
        where: { id: servicioId },
        data: { ...datos, formaCosto, monto },
        select: SELECT_SERVICIO,
      });
    });
    return aServicio(servicio);
  } catch (e) {
    if (esNombreRepetido(e)) throw errorServicioRepetido();
    throw e;
  }
}

/** Baja lógica: deja de ofrecerse y de mostrarse. */
export async function quitarServicio(iglesiaId: string, servicioId: string) {
  await servicioDeIglesia(iglesiaId, servicioId);
  await prisma.servicio.update({ where: { id: servicioId }, data: { activo: false } });
}

/** E3-12 (RF-35, RN-33): lo que el visitante ve en la ficha. Mismo contenido, sin ids internos. */
export async function serviciosPublicos(iglesiaId: string) {
  const servicios = await listarServicios(iglesiaId);
  return servicios.map(({ id: _id, ...s }) => s);
}

// ───────────── Pláticas (RF-36–RF-39) ─────────────

const SELECT_PLATICA = {
  id: true,
  tipo: true,
  sesiones: true,
  costo: true,
  cupo: true,
  lugar: true,
  imparte: true,
  padre: { select: { id: true, nombre: true, titulo: true } },
  horarios: { orderBy: ORDEN_HORARIOS, select: SELECT_HORARIO },
} as const;

type PlaticaLeida = {
  id: string;
  tipo: string;
  sesiones: number;
  costo: { toFixed(n: number): string };
  cupo: number;
  lugar: string;
  imparte: string;
  padre: { id: string; nombre: string; titulo: string | null } | null;
  horarios: Horario[];
};

const aPlatica = (p: PlaticaLeida) => ({ ...p, costo: p.costo.toFixed(2) });

/** Supuesto P-14: si se enlaza a un padre, debe ser de la iglesia. */
async function exigirPadreDeIglesia(iglesiaId: string, padreId: string | null | undefined) {
  if (!padreId) return;
  if (!(await padresService.esPadreDeIglesia(padreId, iglesiaId))) {
    throw AppError.reglaNegocio('El padre que la imparte no está asociado a esta iglesia.');
  }
}

export async function listarPlaticas(iglesiaId: string) {
  const platicas = await prisma.platica.findMany({
    where: { iglesiaId, activo: true },
    orderBy: [{ tipo: 'asc' }, { createdAt: 'asc' }],
    select: SELECT_PLATICA,
  });
  return platicas.map(aPlatica);
}

export async function crearPlatica(iglesiaId: string, datos: CrearPlatica) {
  await exigirPadreDeIglesia(iglesiaId, datos.padreId);
  const { horarios, ...resto } = datos;
  const platica = await prisma.platica.create({
    data: { ...resto, padreId: datos.padreId ?? null, iglesiaId, horarios: { create: horarios } },
    select: SELECT_PLATICA,
  });
  return aPlatica(platica);
}

async function platicaDeIglesia(iglesiaId: string, platicaId: string) {
  const actual = await prisma.platica.findFirst({
    where: { id: platicaId, iglesiaId, activo: true },
    select: { id: true },
  });
  if (!actual) throw AppError.noEncontrado('La plática no existe en esta iglesia.');
}

/** Cambia los datos; si vienen `horarios`, reemplazan a los anteriores (RF-37). */
export async function actualizarPlatica(
  iglesiaId: string,
  platicaId: string,
  cambios: ActualizarPlatica,
) {
  await platicaDeIglesia(iglesiaId, platicaId);
  await exigirPadreDeIglesia(iglesiaId, cambios.padreId);
  const { horarios, ...datos } = cambios;
  const platica = await prisma.$transaction(async (tx) => {
    if (horarios) {
      await tx.horarioPlatica.deleteMany({ where: { platicaId } });
      await tx.horarioPlatica.createMany({ data: horarios.map((h) => ({ ...h, platicaId })) });
    }
    return tx.platica.update({ where: { id: platicaId }, data: datos, select: SELECT_PLATICA });
  });
  return aPlatica(platica);
}

export async function quitarPlatica(iglesiaId: string, platicaId: string) {
  await platicaDeIglesia(iglesiaId, platicaId);
  await prisma.platica.update({ where: { id: platicaId }, data: { activo: false } });
}

/**
 * E3-14 (RF-38, RF-39, RN-33): pláticas de la iglesia para el público, filtrables por tipo
 * («¿cuándo son las pláticas de bautizo?»). Del padre, si lo hay, solo título y nombre (P-19).
 */
export async function platicasPublicas(iglesiaId: string, query: QueryPlaticasPublicas = {}) {
  const platicas = await prisma.platica.findMany({
    where: { iglesiaId, activo: true, ...(query.tipo ? { tipo: query.tipo } : {}) },
    orderBy: [{ tipo: 'asc' }, { createdAt: 'asc' }],
    select: SELECT_PLATICA,
  });
  return platicas.map(({ id: _id, padre: _padre, ...p }) => ({ ...p, costo: p.costo.toFixed(2) }));
}

/** Ruta pública de pláticas: la iglesia debe existir y estar abierta (si no, 404). */
export async function platicasDeIglesiaPublica(iglesiaId: string, query: QueryPlaticasPublicas) {
  await iglesiasService.obtenerPublica(iglesiaId);
  return platicasPublicas(iglesiaId, query);
}

/**
 * RF-83 (deseable): las pláticas de un tipo en todas las iglesias abiertas de un municipio, con su
 * iglesia, días y hora. Supuesto P-29: se muestran todas, agrupadas por iglesia en orden alfabético.
 */
export async function platicasDelMunicipio(query: QueryPlaticasDelMunicipio) {
  const iglesias = await iglesiasService.activasDelLugar({ municipio: query.municipio });
  const resultado = [];
  for (const iglesia of iglesias) {
    const platicas = await platicasPublicas(iglesia.id, { tipo: query.tipo });
    if (platicas.length > 0) {
      resultado.push({
        iglesia: { id: iglesia.id, nombre: iglesia.nombre, tipo: iglesia.tipo },
        platicas,
      });
    }
  }
  return resultado;
}
