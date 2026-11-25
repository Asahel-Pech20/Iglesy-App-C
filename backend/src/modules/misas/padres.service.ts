// Padres (E3-06, Genaro): un padre celebra en varias iglesias (RF-40, RF-41, RN-28).
// Supuesto P-19: la Coordinación crea y edita los datos del padre; cada iglesia solo lo asocia o lo
// desasocia de SU iglesia (RN-32), y crea uno nuevo si todavía no existe.
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import type { ActualizarPadre, CrearPadre, QueryBuscarPadres } from './misas.schemas';

export const SELECT_PADRE = { id: true, nombre: true, titulo: true } as const;

const SELECT_PADRE_NACIONAL = {
  ...SELECT_PADRE,
  activo: true,
  iglesias: {
    where: { activo: true },
    orderBy: { iglesia: { nombre: 'asc' } },
    select: { iglesia: { select: { id: true, nombre: true } } },
  },
} as const;

type PadreNacional = {
  id: string;
  nombre: string;
  titulo: string | null;
  activo: boolean;
  iglesias: { iglesia: { id: string; nombre: string } }[];
};

const aPadreNacional = (p: PadreNacional) => ({
  id: p.id,
  nombre: p.nombre,
  titulo: p.titulo,
  activo: p.activo,
  iglesias: p.iglesias.map((a) => a.iglesia),
});

/** Padres activos asociados a la iglesia (RF-40). La pantalla del diezmo elige de esta lista. */
export async function listarPadresDeIglesia(iglesiaId: string) {
  return prisma.padre.findMany({
    where: { activo: true, iglesias: { some: { iglesiaId, activo: true } } },
    orderBy: { nombre: 'asc' },
    select: SELECT_PADRE,
  });
}

/** ¿El padre está activo y asociado a la iglesia? Lo usan las pláticas (servicios, P-14). */
export async function esPadreDeIglesia(padreId: string, iglesiaId: string): Promise<boolean> {
  const asociacion = await prisma.padreIglesia.findFirst({
    where: { padreId, iglesiaId, activo: true, padre: { activo: true } },
    select: { padreId: true },
  });
  return asociacion !== null;
}

/** ¿Hay ya un padre activo con ese nombre (sin distinguir mayúsculas)? */
async function padreConNombre(nombre: string, excepto?: string) {
  return prisma.padre.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      activo: true,
      ...(excepto ? { id: { not: excepto } } : {}),
    },
    select: { id: true },
  });
}

function errorNombreRepetido(padreId: string) {
  return AppError.conflicto(
    'Ya hay un padre registrado con ese nombre. Asócialo a tu iglesia en lugar de crearlo de nuevo.',
    [{ campo: 'nombre', mensaje: `Padre existente: ${padreId}` }],
  );
}

/**
 * El administrador registra un padre nuevo y queda asociado a su iglesia (RF-40). Si ya existe uno
 * con el mismo nombre, se pide asociarlo (supuesto P-19: evita duplicar al mismo padre).
 */
export async function crearPadreEnIglesia(iglesiaId: string, datos: CrearPadre) {
  const existente = await padreConNombre(datos.nombre);
  if (existente) throw errorNombreRepetido(existente.id);
  return prisma.padre.create({
    data: {
      nombre: datos.nombre,
      titulo: datos.titulo ?? null,
      iglesias: { create: { iglesiaId } },
    },
    select: SELECT_PADRE,
  });
}

/** Asocia a la iglesia un padre que ya existe (RF-41). Repetirlo no cambia nada. */
export async function asociarPadre(iglesiaId: string, padreId: string) {
  const padre = await prisma.padre.findFirst({
    where: { id: padreId, activo: true },
    select: SELECT_PADRE,
  });
  if (!padre) throw AppError.noEncontrado('El padre no existe o está dado de baja.');
  await prisma.padreIglesia.upsert({
    where: { padreId_iglesiaId: { padreId, iglesiaId } },
    create: { padreId, iglesiaId },
    update: { activo: true },
  });
  return padre;
}

/**
 * Quita al padre de la iglesia sin perder su historial (baja lógica). Si todavía tiene misas en el
 * horario de esa iglesia, primero hay que reasignarlas: si no, el horario quedaría sin padre.
 */
export async function desasociarPadre(iglesiaId: string, padreId: string) {
  const asociacion = await prisma.padreIglesia.findFirst({
    where: { padreId, iglesiaId, activo: true },
    select: { padreId: true },
  });
  if (!asociacion) throw AppError.noEncontrado('El padre no está asociado a esta iglesia.');
  const enHorario = await prisma.horarioMisa.count({
    where: { padreId, iglesiaId, activo: true },
  });
  if (enHorario > 0) {
    throw AppError.reglaNegocio(
      `El padre tiene ${enHorario} misa(s) en el horario de esta iglesia. Asígnalas a otro padre antes de quitarlo.`,
    );
  }
  await prisma.padreIglesia.update({
    where: { padreId_iglesiaId: { padreId, iglesiaId } },
    data: { activo: false },
  });
}

/** Padres de todo el país con sus iglesias, para que la Coordinación los administre y las iglesias
 * encuentren a uno que ya existe antes de crearlo. */
export async function buscarPadres(query: QueryBuscarPadres) {
  const { page, limit, skip, take } = paginar(query);
  const where = query.q ? { nombre: { contains: query.q, mode: 'insensitive' as const } } : {};
  const [padres, total] = await Promise.all([
    prisma.padre.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      skip,
      take,
      select: SELECT_PADRE_NACIONAL,
    }),
    prisma.padre.count({ where }),
  ]);
  return { datos: padres.map(aPadreNacional), meta: crearMeta(total, page, limit) };
}

/** La Coordinación registra un padre sin asociarlo todavía a ninguna iglesia (supuesto P-19). */
export async function crearPadre(datos: CrearPadre) {
  const existente = await padreConNombre(datos.nombre);
  if (existente) throw errorNombreRepetido(existente.id);
  const padre = await prisma.padre.create({
    data: { nombre: datos.nombre, titulo: datos.titulo ?? null },
    select: SELECT_PADRE_NACIONAL,
  });
  return aPadreNacional(padre);
}

/**
 * La Coordinación corrige los datos del padre o lo da de baja (supuesto P-19). Un padre con misas
 * en algún horario no se da de baja: primero se reasignan.
 */
export async function actualizarPadre(padreId: string, datos: ActualizarPadre) {
  const actual = await prisma.padre.findUnique({ where: { id: padreId }, select: { id: true } });
  if (!actual) throw AppError.noEncontrado('El padre no existe.');
  if (datos.nombre) {
    const existente = await padreConNombre(datos.nombre, padreId);
    if (existente) throw errorNombreRepetido(existente.id);
  }
  if (datos.activo === false) {
    const enHorario = await prisma.horarioMisa.count({ where: { padreId, activo: true } });
    if (enHorario > 0) {
      throw AppError.reglaNegocio(
        `El padre tiene ${enHorario} misa(s) en horarios de iglesias. Asígnalas a otro padre antes de darlo de baja.`,
      );
    }
  }
  const padre = await prisma.padre.update({
    where: { id: padreId },
    data: datos,
    select: SELECT_PADRE_NACIONAL,
  });
  return aPadreNacional(padre);
}
