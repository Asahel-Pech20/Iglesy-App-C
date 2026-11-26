// Misas celebradas (E3-09, Genaro; versión mínima de Oscar para el diezmo). Una misa celebrada es
// un hecho: un día, una hora y el padre que realmente la ofició, que puede no ser el programado
// (RN-29). La sustitución guarda quién hizo el cambio y por qué, y no se edita (RF-49–51, RN-30).
// Los padres están en padres.service.ts y el horario semanal en horario.service.ts.
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import { resolverPeriodo } from '../../lib/dominio/periodo';
import { fechaYHoraLocal, instanteLocal } from '../../lib/dominio/zona';
import {
  buscarChoqueEnIntervalo,
  diaDeLaSemana,
  intervaloCelebrada,
  puedeRegistrarCelebracion,
  type DiaSemana,
} from './dominio/solapes';
import { NOMBRES_DIA } from './horario.service';
import type { CrearMisa, CrearMisaDeHorario, QueryListarMisas } from './misas.schemas';

const SELECT_PADRE = { id: true, nombre: true } as const;
const SELECT_PERSONA = { id: true, nombre: true } as const;

const SELECT_MISA = {
  id: true,
  inicio: true,
  horarioMisaId: true,
  padre: { select: SELECT_PADRE },
  diezmo: true,
  sustitucion: {
    select: {
      motivo: true,
      hechaEn: true,
      padreProgramado: { select: SELECT_PADRE },
      hechaPor: { select: SELECT_PERSONA },
    },
  },
} as const;

/** Zona horaria de la iglesia; las fechas y horas de sus misas son locales (RN-31). */
async function zonaDe(iglesiaId: string) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return iglesia.zonaHoraria;
}

type MisaLeida = {
  id: string;
  inicio: Date;
  horarioMisaId: string | null;
  padre: { id: string; nombre: string };
  diezmo: { monto: { toFixed(d: number): string }; updatedAt: Date } | null;
  sustitucion: {
    motivo: string;
    hechaEn: Date;
    padreProgramado: { id: string; nombre: string };
    hechaPor: { id: string; nombre: string };
  } | null;
};

const aMisa = (zona: string, m: MisaLeida) => ({
  id: m.id,
  inicio: m.inicio,
  // Fecha y hora en la zona horaria de la iglesia: así se muestran (RN-31)
  fechaLocal: fechaYHoraLocal(m.inicio, zona).fecha,
  horaLocal: fechaYHoraLocal(m.inicio, zona).hora,
  // Quién la dio realmente (RN-29, RF-51)
  padre: m.padre,
  horarioMisaId: m.horarioMisaId,
  // Si hubo sustitución: el programado, quién hizo el cambio, por qué y cuándo (RF-50, RF-51)
  sustitucion: m.sustitucion
    ? {
        padreProgramado: m.sustitucion.padreProgramado,
        motivo: m.sustitucion.motivo,
        hechaPor: m.sustitucion.hechaPor,
        hechaEn: m.sustitucion.hechaEn,
      }
    : null,
  diezmo: m.diezmo ? { monto: m.diezmo.monto.toFixed(2), actualizadoEn: m.diezmo.updatedAt } : null,
});

async function exigirHoraLibreEnIglesia(iglesiaId: string, inicio: Date) {
  const repetida = await prisma.misaCelebrada.findFirst({
    where: { iglesiaId, inicio },
    select: { id: true },
  });
  if (repetida) throw AppError.conflicto('Ya hay una misa registrada a esa hora en esta iglesia.');
}

/**
 * Registra una misa ya celebrada (RF-48). Dos formas:
 * - Desde el horario (`horarioMisaId` + `fecha`): la hora sale del horario y, si la dio otro padre,
 *   se guarda la sustitución con su motivo (RF-49, RF-50).
 * - Suelta (`inicio` + `padreId`): la usa el diezmo y sirve para una misa especial de una sola
 *   fecha (supuesto P-16).
 */
export async function registrarMisa(iglesiaId: string, datos: CrearMisa, usuarioId: string) {
  if ('horarioMisaId' in datos) return registrarDesdeHorario(iglesiaId, datos, usuarioId);

  const zona = await zonaDe(iglesiaId);
  const inicio = new Date(datos.inicio);
  if (!puedeRegistrarCelebracion(inicio, new Date())) {
    throw AppError.reglaNegocio('Solo se registran misas que ya se celebraron.');
  }
  const padre = await prisma.padre.findFirst({
    where: { id: datos.padreId, activo: true },
    select: { id: true },
  });
  if (!padre) throw AppError.noEncontrado('El padre no existe.');
  await exigirHoraLibreEnIglesia(iglesiaId, inicio);
  const misa = await prisma.misaCelebrada.create({
    data: { iglesiaId, inicio, padreId: padre.id, registradoPorId: usuarioId },
    select: SELECT_MISA,
  });
  return aMisa(zona, misa);
}

async function registrarDesdeHorario(
  iglesiaId: string,
  datos: CrearMisaDeHorario,
  usuarioId: string,
) {
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
  const inicio = instanteLocal(datos.fecha, horario.hora, zona);
  if (!inicio) throw AppError.reglaNegocio('Esa hora no existe ese día en la zona de la iglesia.');
  // Supuesto P-17: solo cuando la misa ya empezó
  if (!puedeRegistrarCelebracion(inicio, new Date())) {
    throw AppError.reglaNegocio('Solo se registran misas que ya empezaron.');
  }

  const padreReal = datos.padreId ?? horario.padreId;
  const hayCambio = padreReal !== horario.padreId;
  if (hayCambio && !datos.motivo) {
    throw AppError.validacion('Indica por qué la dio otro padre.', [
      { campo: 'motivo', mensaje: 'La sustitución necesita un motivo (RF-49).' },
    ]);
  }
  if (!hayCambio && datos.motivo) {
    throw AppError.validacion('El motivo solo se indica cuando la dio otro padre.', [
      { campo: 'motivo', mensaje: 'Quita el motivo o indica el padre que la dio.' },
    ]);
  }
  if (hayCambio) await validarSustituto(iglesiaId, padreReal, inicio, horario);

  const ocupada = await prisma.misaCelebrada.findFirst({
    where: { horarioMisaId: horario.id, fecha: new Date(datos.fecha) },
    select: { id: true },
  });
  if (ocupada) throw AppError.conflicto('Esa misa ya está registrada en esa fecha.');
  await exigirHoraLibreEnIglesia(iglesiaId, inicio);

  try {
    const misa = await prisma.$transaction(async (tx) => {
      const creada = await tx.misaCelebrada.create({
        data: {
          iglesiaId,
          inicio,
          padreId: padreReal,
          horarioMisaId: horario.id,
          fecha: new Date(datos.fecha),
          duracionMin: horario.duracionMin,
          registradoPorId: usuarioId,
        },
        select: { id: true },
      });
      if (hayCambio) {
        await tx.sustitucionMisa.create({
          data: {
            misaCelebradaId: creada.id,
            padreProgramadoId: horario.padreId,
            padreRealId: padreReal,
            motivo: datos.motivo as string,
            hechaPorId: usuarioId,
          },
        });
      }
      return tx.misaCelebrada.findUniqueOrThrow({ where: { id: creada.id }, select: SELECT_MISA });
    });
    return aMisa(zona, misa);
  } catch (error) {
    // Dos registros simultáneos de la misma misa y día: el índice único decide (P-17)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflicto('Esa misa ya está registrada en esa fecha.');
    }
    throw error;
  }
}

/**
 * Supuesto P-17: el sustituto está asociado a la iglesia y no tiene otra misa de su horario a esa
 * hora (la misma regla que RN-26).
 */
async function validarSustituto(
  iglesiaId: string,
  padreId: string,
  inicio: Date,
  horario: { id: string; duracionMin: number | null },
) {
  const asociado = await prisma.padreIglesia.findFirst({
    where: { padreId, iglesiaId, activo: true, padre: { activo: true } },
    select: { padreId: true },
  });
  if (!asociado) {
    throw AppError.reglaNegocio('El padre que la dio no está asociado a esta iglesia.');
  }
  const suyas = await prisma.horarioMisa.findMany({
    where: { padreId, activo: true },
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
    throw AppError.conflicto(
      `El padre que la dio tiene su propia misa el ${NOMBRES_DIA[choque.misa.diaSemana]} a las ${choque.misa.hora} en ${choque.misa.nombreIglesia}.`,
    );
  }
}

/** Misas celebradas de la iglesia en un periodo (por omisión, el mes en curso), con su diezmo y,
 * si hubo, su sustitución (RF-51). */
export async function listarMisas(iglesiaId: string, query: QueryListarMisas) {
  const zona = await zonaDe(iglesiaId);
  const periodo = resolverPeriodo(query.desde, query.hasta, zona, new Date());
  if (!periodo.ok) {
    throw AppError.validacion('El periodo no es válido.', [
      {
        campo: 'desde',
        mensaje:
          periodo.motivo === 'RANGO_INVERTIDO'
            ? 'La fecha inicial no puede ser posterior a la final.'
            : 'Usa fechas reales con el formato aaaa-mm-dd.',
      },
    ]);
  }
  const { page, limit, skip, take } = paginar(query);
  const where = {
    iglesiaId,
    inicio: { gte: periodo.periodo.inicio, lt: periodo.periodo.finExcluido },
  };
  const [misas, total] = await Promise.all([
    prisma.misaCelebrada.findMany({
      where,
      orderBy: { inicio: 'desc' },
      skip,
      take,
      select: SELECT_MISA,
    }),
    prisma.misaCelebrada.count({ where }),
  ]);
  return { datos: misas.map((m) => aMisa(zona, m)), meta: crearMeta(total, page, limit) };
}
