// E3-25 (Genaro): «días inhábiles», de las notas del docente del 2026-11-19 («modificar los horarios,
// aceptar o no en días inhábiles»). Supuesto P-33, pendiente con el cliente:
// - El administrador marca una fecha en la que una misa del horario no se celebra (SIN_MISA) o se
//   celebra a otra hora ese día (OTRA_HORA), siempre con un motivo.
// - El horario semanal no cambia; la excepción vale solo para esa fecha. El público la ve.
// - No se marca ni se quita una excepción de una misa que ya se registró como celebrada.
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { prisma } from '../../lib/prisma';
import * as iglesiasService from '../iglesias/iglesias.service';
import { fechaYHoraLocal, instanteLocal } from '../../lib/dominio/zona';
import {
  buscarChoqueEnIntervalo,
  diaDeLaSemana,
  intervaloCelebrada,
  NOMBRES_DIA,
  sumarDias,
  type DiaSemana,
} from './dominio/solapes';
import type { CrearExcepcion, QueryListarExcepciones } from './misas.schemas';

/** Días que se muestran por omisión, desde hoy (fecha local de la iglesia). */
export const DIAS_POR_OMISION = 60;

const SELECT_EXCEPCION = {
  id: true,
  fecha: true,
  tipo: true,
  horaNueva: true,
  motivo: true,
  createdAt: true,
  registradoPor: { select: { id: true, nombre: true } },
  horarioMisa: {
    select: {
      id: true,
      diaSemana: true,
      hora: true,
      tipo: true,
      padre: { select: { id: true, nombre: true, titulo: true } },
    },
  },
} as const;

type ExcepcionLeida = Prisma.ExcepcionMisaGetPayload<{ select: typeof SELECT_EXCEPCION }>;

const aExcepcion = (e: ExcepcionLeida) => ({
  id: e.id,
  fecha: e.fecha.toISOString().slice(0, 10),
  tipo: e.tipo,
  horaNueva: e.horaNueva,
  motivo: e.motivo,
  registradoPor: e.registradoPor,
  registradaEn: e.createdAt,
  misa: {
    horarioId: e.horarioMisa.id,
    diaSemana: e.horarioMisa.diaSemana,
    hora: e.horarioMisa.hora,
    tipo: e.horarioMisa.tipo,
    padre: e.horarioMisa.padre,
  },
});

async function zonaDe(iglesiaId: string) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return iglesia.zonaHoraria;
}

function periodo(query: QueryListarExcepciones, zona: string) {
  const desde = query.desde ?? fechaYHoraLocal(new Date(), zona).fecha;
  return { desde, hasta: query.hasta ?? sumarDias(desde, DIAS_POR_OMISION) };
}

/** Excepciones de la iglesia en un periodo (por omisión, de hoy a 60 días), por fecha y hora. */
export async function listarExcepciones(iglesiaId: string, query: QueryListarExcepciones) {
  const { desde, hasta } = periodo(query, await zonaDe(iglesiaId));
  const excepciones = await prisma.excepcionMisa.findMany({
    where: { iglesiaId, fecha: { gte: new Date(desde), lte: new Date(hasta) } },
    orderBy: [{ fecha: 'asc' }, { horarioMisa: { hora: 'asc' } }],
    select: SELECT_EXCEPCION,
  });
  return { desde, hasta, excepciones: excepciones.map(aExcepcion) };
}

async function exigirSinCelebrar(horarioMisaId: string, fecha: string, accion: string) {
  const celebrada = await prisma.misaCelebrada.findFirst({
    where: { horarioMisaId, fecha: new Date(fecha) },
    select: { id: true },
  });
  if (celebrada) {
    throw AppError.conflicto(
      `Esa misa ya se registró como celebrada el ${fecha}: no se puede ${accion}.`,
    );
  }
}

/**
 * Marca una fecha como «sin misa» u «otra hora» para una misa del horario. Con otra hora, el padre
 * programado no puede tener otra misa que se empalme (la misma regla que RN-26).
 */
export async function crearExcepcion(iglesiaId: string, datos: CrearExcepcion, usuarioId: string) {
  const zona = await zonaDe(iglesiaId);
  const horario = await prisma.horarioMisa.findFirst({
    where: { id: datos.horarioMisaId, iglesiaId, activo: true },
    select: { id: true, diaSemana: true, hora: true, duracionMin: true, padreId: true },
  });
  if (!horario) throw AppError.noEncontrado('La misa no está en el horario de esta iglesia.');

  const dia = diaDeLaSemana(datos.fecha);
  if (dia !== horario.diaSemana) {
    throw AppError.reglaNegocio(
      `El ${datos.fecha} es ${NOMBRES_DIA[dia]}, pero esa misa del horario es los ${NOMBRES_DIA[horario.diaSemana]}.`,
    );
  }
  await exigirSinCelebrar(horario.id, datos.fecha, 'marcar como día inhábil');

  if (datos.tipo === 'OTRA_HORA') {
    const horaNueva = datos.horaNueva as string;
    if (horaNueva === horario.hora) {
      throw AppError.validacion('La hora nueva es la misma del horario.', [
        { campo: 'horaNueva', mensaje: 'Elige una hora distinta a la del horario.' },
      ]);
    }
    const inicio = instanteLocal(datos.fecha, horaNueva, zona);
    if (!inicio)
      throw AppError.reglaNegocio('Esa hora no existe ese día en la zona de la iglesia.');
    await exigirPadreLibre(horario, inicio);
  }

  try {
    const creada = await prisma.excepcionMisa.create({
      data: {
        iglesiaId,
        horarioMisaId: horario.id,
        fecha: new Date(datos.fecha),
        tipo: datos.tipo,
        horaNueva: datos.tipo === 'OTRA_HORA' ? (datos.horaNueva as string) : null,
        motivo: datos.motivo,
        registradoPorId: usuarioId,
      },
      select: SELECT_EXCEPCION,
    });
    return aExcepcion(creada);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflicto(
        'Esa misa ya tiene una excepción en esa fecha. Quítala para cambiarla.',
      );
    }
    throw error;
  }
}

/** A la hora nueva, el padre programado no tiene otra misa de su horario que se empalme (RN-26). */
async function exigirPadreLibre(
  horario: { id: string; duracionMin: number | null; padreId: string },
  inicio: Date,
) {
  const suyas = await prisma.horarioMisa.findMany({
    where: { padreId: horario.padreId, activo: true },
    select: {
      id: true,
      iglesiaId: true,
      diaSemana: true,
      hora: true,
      duracionMin: true,
      iglesia: { select: { nombre: true, zonaHoraria: true } },
    },
  });
  const choque = buscarChoqueEnIntervalo(
    intervaloCelebrada(inicio, horario.duracionMin),
    suyas.map((m) => ({
      id: m.id,
      iglesiaId: m.iglesiaId,
      diaSemana: m.diaSemana as DiaSemana,
      hora: m.hora,
      duracionMin: m.duracionMin,
      zonaHoraria: m.iglesia.zonaHoraria,
      nombreIglesia: m.iglesia.nombre,
    })),
    horario.id,
  );
  if (choque) {
    const m = choque.misa;
    throw AppError.conflicto(
      `A esa hora el padre tiene su misa del ${NOMBRES_DIA[m.diaSemana]} a las ${m.hora} en ${m.nombreIglesia}.`,
    );
  }
}

/** Quita la excepción; la misa vuelve a su horario normal ese día. */
export async function quitarExcepcion(iglesiaId: string, excepcionId: string) {
  const excepcion = await prisma.excepcionMisa.findFirst({
    where: { id: excepcionId, iglesiaId },
    select: { id: true, horarioMisaId: true, fecha: true },
  });
  if (!excepcion) throw AppError.noEncontrado('La excepción no existe en esta iglesia.');
  await exigirSinCelebrar(
    excepcion.horarioMisaId,
    excepcion.fecha.toISOString().slice(0, 10),
    'quitar la excepción',
  );
  await prisma.excepcionMisa.delete({ where: { id: excepcion.id } });
}

/** Excepción de una misa del horario en una fecha, si la hay (la usa el registro de la misa). */
export async function excepcionDe(horarioMisaId: string, fecha: string) {
  return prisma.excepcionMisa.findUnique({
    where: { horarioMisaId_fecha: { horarioMisaId, fecha: new Date(fecha) } },
    select: { tipo: true, horaNueva: true, motivo: true },
  });
}

/** Excepciones de varias misas del horario en un rango de fechas, por «horarioId|fecha». */
export async function excepcionesPorMisa(horarioIds: string[], desde: string, hasta: string) {
  if (horarioIds.length === 0) return new Map<string, ExcepcionCorta>();
  const filas = await prisma.excepcionMisa.findMany({
    where: {
      horarioMisaId: { in: horarioIds },
      fecha: { gte: new Date(desde), lte: new Date(hasta) },
    },
    select: { horarioMisaId: true, fecha: true, tipo: true, horaNueva: true, motivo: true },
  });
  return new Map<string, ExcepcionCorta>(
    filas.map((f) => [
      `${f.horarioMisaId}|${f.fecha.toISOString().slice(0, 10)}`,
      { tipo: f.tipo, horaNueva: f.horaNueva, motivo: f.motivo },
    ]),
  );
}

export interface ExcepcionCorta {
  tipo: 'SIN_MISA' | 'OTRA_HORA';
  horaNueva: string | null;
  motivo: string;
}

/**
 * Para el público (RN-33): los cambios al horario de hoy a 60 días, en la hora local de la iglesia.
 * Del padre solo título y nombre (P-19); no se muestra quién la registró.
 */
export async function excepcionesPublicas(iglesiaId: string, query: QueryListarExcepciones = {}) {
  const { desde, hasta, excepciones } = await listarExcepciones(iglesiaId, query);
  return {
    desde,
    hasta,
    excepciones: excepciones.map((e) => ({
      fecha: e.fecha,
      diaSemana: e.misa.diaSemana,
      hora: e.misa.hora,
      tipoMisa: e.misa.tipo,
      tipo: e.tipo,
      horaNueva: e.horaNueva,
      motivo: e.motivo,
      padre: e.misa.padre.titulo
        ? `${e.misa.padre.titulo} ${e.misa.padre.nombre}`
        : e.misa.padre.nombre,
    })),
  };
}

/** Ruta pública: la iglesia debe existir y estar abierta (si no, 404), como sus pláticas. */
export async function excepcionesDeIglesiaPublica(
  iglesiaId: string,
  query: QueryListarExcepciones,
) {
  await iglesiasService.obtenerPublica(iglesiaId);
  return excepcionesPublicas(iglesiaId, query);
}
