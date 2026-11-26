// Horario semanal de misas (E3-07, Genaro): qué días, a qué hora, tipo, idioma y el padre que
// oficia (RF-42, RF-43, RF-46). Un padre nunca queda en dos misas que se empalmen, aunque sean en
// templos distintos (RF-45, RN-26): se valida al programar y al cambiar, con misas/dominio/solapes.ts.
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { prisma, type TransaccionPrisma } from '../../lib/prisma';
import { fechaYHoraLocal, instanteLocal } from '../../lib/dominio/zona';
import {
  buscarChoque,
  domingoDeLaSemana,
  intervaloCelebrada,
  NOMBRES_DIA,
  intervaloEnSemana,
  semanasDeReferencia,
  sumarDias,
  type DiaSemana,
  type MisaProgramada,
} from './dominio/solapes';
import { excepcionesPorMisa } from './excepciones.service';
import type { ActualizarHorario, CrearHorario, QueryAgenda } from './misas.schemas';
import { SELECT_PADRE } from './padres.service';

// NOMBRES_DIA vive en el dominio (lo usa también excepciones.service.ts); se reexporta aquí
export { NOMBRES_DIA } from './dominio/solapes';

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

// ───────────── Agenda semanal de un padre (E3-08: RF-47, supuesto P-18) ─────────────

/** Zona de referencia para «la semana en curso» cuando no se indica otra. */
const ZONA_COORDINACION = 'America/Mexico_City';

/**
 * Todas las misas del horario de un padre en una semana, de todas las iglesias donde celebra, con la
 * fecha y la hora locales de cada iglesia (RN-31) y ordenadas por el momento real.
 * Supuesto P-18: la ve la Coordinación y el personal de las iglesias del padre (no el público); se
 * arma con el horario normal y las iglesias cerradas no aparecen.
 */
export async function agendaDelPadre(
  padreId: string,
  iglesiaDelUsuario: string | null,
  query: QueryAgenda,
) {
  const padre = await prisma.padre.findUnique({
    where: { id: padreId },
    select: { ...SELECT_PADRE, activo: true },
  });
  if (!padre) throw AppError.noEncontrado('El padre no existe.');
  if (iglesiaDelUsuario !== null) {
    const celebraAqui = await prisma.padreIglesia.findFirst({
      where: { padreId, iglesiaId: iglesiaDelUsuario, activo: true },
      select: { padreId: true },
    });
    if (!celebraAqui) {
      throw AppError.prohibido('Solo ves la agenda de los padres que celebran en tu iglesia.');
    }
  }

  const dia = query.semana ?? fechaYHoraLocal(new Date(), ZONA_COORDINACION).fecha;
  const domingo = domingoDeLaSemana(dia);
  const horarios = await prisma.horarioMisa.findMany({
    where: { padreId, activo: true, iglesia: { activa: true } },
    select: {
      id: true,
      diaSemana: true,
      hora: true,
      tipo: true,
      idioma: true,
      duracionMin: true,
      iglesia: { select: { id: true, nombre: true, zonaHoraria: true } },
    },
  });

  // E3-25: días sin misa u otra hora (un día de margen por las zonas horarias)
  const excepciones = await excepcionesPorMisa(
    horarios.map((h) => h.id),
    sumarDias(domingo, -1),
    sumarDias(domingo, 7),
  );

  const misas = horarios
    .map((h) => {
      const enSemana = intervaloEnSemana(
        {
          iglesiaId: h.iglesia.id,
          diaSemana: h.diaSemana as DiaSemana,
          hora: h.hora,
          duracionMin: h.duracionMin,
          zonaHoraria: h.iglesia.zonaHoraria,
        },
        domingo,
      );
      if (!enSemana) return null;
      const fecha = fechaYHoraLocal(enSemana.inicio, h.iglesia.zonaHoraria).fecha;
      const excepcion = excepciones.get(`${h.id}|${fecha}`) ?? null;
      const inicioNuevo =
        excepcion?.tipo === 'OTRA_HORA'
          ? instanteLocal(fecha, excepcion.horaNueva as string, h.iglesia.zonaHoraria)
          : null;
      const intervalo = inicioNuevo ? intervaloCelebrada(inicioNuevo, h.duracionMin) : enSemana;
      return {
        horarioId: h.id,
        iglesia: { id: h.iglesia.id, nombre: h.iglesia.nombre },
        diaSemana: h.diaSemana,
        fecha,
        hora: inicioNuevo ? (excepcion?.horaNueva as string) : h.hora,
        zonaHoraria: h.iglesia.zonaHoraria,
        duracionMin: h.duracionMin,
        tipo: h.tipo,
        idioma: h.idioma,
        inicio: intervalo.inicio,
        fin: intervalo.fin,
        // SIN_MISA u OTRA_HORA ese día, con la hora del horario y el motivo (E3-25)
        excepcion: excepcion ? { ...excepcion, horaHorario: h.hora } : null,
      };
    })
    .filter((m) => m !== null)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  return {
    padre: { id: padre.id, nombre: padre.nombre, titulo: padre.titulo, activo: padre.activo },
    semana: { desde: domingo, hasta: sumarDias(domingo, 6) },
    misas,
  };
}

// ───────────── Consulta pública (E3-10: RF-44, RF-52, RN-31, RN-33) ─────────────

/**
 * Horario semanal para el público, en la hora local de la iglesia (sin convertirla a la de quien
 * consulta, RF-52). Del padre solo se muestra el título y el nombre (supuesto P-19).
 * La ficha pública de Nataly (E2-11) lo usa; la iglesia ya viene validada como pública.
 */
export async function horarioPublico(iglesiaId: string) {
  const horario = await prisma.horarioMisa.findMany({
    where: { iglesiaId, activo: true },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    select: {
      diaSemana: true,
      hora: true,
      tipo: true,
      idioma: true,
      duracionMin: true,
      padre: { select: { nombre: true, titulo: true } },
    },
  });
  return horario.map((m) => ({
    diaSemana: m.diaSemana,
    hora: m.hora,
    tipo: m.tipo,
    idioma: m.idioma,
    duracionMin: m.duracionMin,
    padre: m.padre.titulo ? `${m.padre.titulo} ${m.padre.nombre}` : m.padre.nombre,
  }));
}
