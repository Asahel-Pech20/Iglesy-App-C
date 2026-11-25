// Horario semanal de misas (E3-07, Genaro): qué días, a qué hora, tipo, idioma y el padre que
// oficia (RF-42, RF-43, RF-46). Un padre nunca queda en dos misas que se empalmen, aunque sean en
// templos distintos (RF-45, RN-26): se valida al programar y al cambiar, con misas/dominio/solapes.ts.
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { prisma, type TransaccionPrisma } from '../../lib/prisma';
import { instanteLocal } from '../../lib/dominio/zona';
import {
  buscarChoque,
  domingoDeLaSemana,
  semanasDeReferencia,
  sumarDias,
  type DiaSemana,
  type MisaProgramada,
} from './dominio/solapes';
import type { ActualizarHorario, CrearHorario } from './misas.schemas';
import { SELECT_PADRE } from './padres.service';

export const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

const SELECT_HORARIO = {
  id: true,
  diaSemana: true,
  hora: true,
  tipo: true,
  idioma: true,
  duracionMin: true,
  activo: true,
  padre: { select: SELECT_PADRE },
} as const;

/** Horario semanal vigente de la iglesia, de domingo a sábado y por hora (RF-42, RF-44). */
export async function listarHorario(iglesiaId: string) {
  return prisma.horarioMisa.findMany({
    where: { iglesiaId, activo: true },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    select: SELECT_HORARIO,
  });
}

interface DatosHorario {
  diaSemana: number;
  hora: string;
  tipo: CrearHorario['tipo'];
  idioma: NonNullable<CrearHorario['idioma']>;
  duracionMin: number | null;
  padreId: string;
}

/**
 * Valida y guarda una misa del horario en una transacción. El padre se bloquea (`FOR UPDATE`) para
 * que dos altas simultáneas con el mismo padre no se salten la revisión de choques.
 */
async function guardar(
  tx: TransaccionPrisma,
  iglesiaId: string,
  datos: DatosHorario,
  horarioId?: string,
) {
  // sql-sin-iglesia: bloquea la fila del padre, que no es de la gestión interna (ADR-0007)
  const bloqueado = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "padres" WHERE "id" = ${datos.padreId} AND "activo" FOR UPDATE`,
  );
  if (bloqueado.length === 0) {
    throw AppError.validacion('El padre no existe o está dado de baja.', [
      { campo: 'padreId', mensaje: 'Elige un padre activo.' },
    ]);
  }
  const asociado = await tx.padreIglesia.findFirst({
    where: { padreId: datos.padreId, iglesiaId, activo: true },
    select: { padreId: true },
  });
  if (!asociado) {
    throw AppError.reglaNegocio(
      'El padre no está asociado a esta iglesia. Asócialo antes de asignarle misas.',
    );
  }

  const iglesia = await tx.iglesia.findUniqueOrThrow({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  const ahora = new Date();
  const nueva: MisaProgramada = {
    ...(horarioId ? { id: horarioId } : {}),
    iglesiaId,
    diaSemana: datos.diaSemana as DiaSemana,
    hora: datos.hora,
    duracionMin: datos.duracionMin,
    zonaHoraria: iglesia.zonaHoraria,
  };
  // Una hora que no existe en la zona de la iglesia (salto del horario de verano) no se programa
  const fecha = sumarDias(domingoDeLaSemana(ahora.toISOString().slice(0, 10)), datos.diaSemana);
  if (!instanteLocal(fecha, datos.hora, iglesia.zonaHoraria)) {
    throw AppError.reglaNegocio('Esa hora no existe en la zona horaria de la iglesia.');
  }

  // Misas del padre en TODAS sus iglesias (RN-26)
  const delPadre = await tx.horarioMisa.findMany({
    where: { padreId: datos.padreId, activo: true },
    select: {
      id: true,
      iglesiaId: true,
      diaSemana: true,
      hora: true,
      duracionMin: true,
      iglesia: { select: { nombre: true, zonaHoraria: true } },
    },
  });
  const existentes = delPadre.map((m) => ({
    id: m.id,
    iglesiaId: m.iglesiaId,
    diaSemana: m.diaSemana as DiaSemana,
    hora: m.hora,
    duracionMin: m.duracionMin,
    zonaHoraria: m.iglesia.zonaHoraria,
    nombreIglesia: m.iglesia.nombre,
  }));
  const choque = buscarChoque(nueva, existentes, semanasDeReferencia(ahora));
  if (choque) {
    const m = choque.misa;
    // RF-45: se le dice al administrador con cuál choca (en la hora local de esa iglesia)
    throw AppError.conflicto(
      `El padre ya tiene una misa el ${NOMBRES_DIA[m.diaSemana]} a las ${m.hora} en ${m.nombreIglesia} que se empalma con esta.`,
      [
        { campo: 'padreId', mensaje: `Choca con la misa ${m.id} de la iglesia ${m.iglesiaId}.` },
        { campo: 'iglesia', mensaje: m.nombreIglesia },
        { campo: 'diaSemana', mensaje: String(m.diaSemana) },
        { campo: 'hora', mensaje: m.hora },
      ],
    );
  }

  const data = {
    diaSemana: datos.diaSemana,
    hora: datos.hora,
    tipo: datos.tipo,
    idioma: datos.idioma,
    duracionMin: datos.duracionMin,
    padreId: datos.padreId,
  };
  return horarioId
    ? tx.horarioMisa.update({ where: { id: horarioId }, data, select: SELECT_HORARIO })
    : tx.horarioMisa.create({ data: { ...data, iglesiaId }, select: SELECT_HORARIO });
}

/** Programa una misa en el horario semanal (RF-42, RF-43). 409 si el padre choca (RF-45). */
export async function crearMisaHorario(iglesiaId: string, datos: CrearHorario) {
  return prisma.$transaction((tx) =>
    guardar(tx, iglesiaId, {
      diaSemana: datos.diaSemana,
      hora: datos.hora,
      tipo: datos.tipo,
      idioma: datos.idioma ?? 'ESPANOL',
      duracionMin: datos.duracionMin ?? null,
      padreId: datos.padreId,
    }),
  );
}

async function horarioDeIglesia(iglesiaId: string, horarioId: string) {
  const actual = await prisma.horarioMisa.findFirst({
    where: { id: horarioId, iglesiaId, activo: true },
    select: {
      diaSemana: true,
      hora: true,
      tipo: true,
      idioma: true,
      duracionMin: true,
      padreId: true,
    },
  });
  if (!actual) throw AppError.noEncontrado('La misa no está en el horario de esta iglesia.');
  return actual;
}

/** Cambia día, hora, tipo, idioma, duración o padre; vuelve a revisar los choques (RN-26). */
export async function actualizarMisaHorario(
  iglesiaId: string,
  horarioId: string,
  cambios: ActualizarHorario,
) {
  const actual = await horarioDeIglesia(iglesiaId, horarioId);
  return prisma.$transaction((tx) => guardar(tx, iglesiaId, { ...actual, ...cambios }, horarioId));
}

/**
 * Quita la misa del horario. Es baja lógica: las misas ya celebradas siguen apuntando a ella
 * (RN-29), así que no se borra.
 */
export async function quitarMisaHorario(iglesiaId: string, horarioId: string) {
  await horarioDeIglesia(iglesiaId, horarioId);
  await prisma.horarioMisa.update({ where: { id: horarioId }, data: { activo: false } });
}
