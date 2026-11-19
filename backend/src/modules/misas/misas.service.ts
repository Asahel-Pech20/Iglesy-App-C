// Versión mínima del módulo de misas (padres y misas celebradas). Lo usa el diezmo.
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import { resolverPeriodo } from '../../lib/dominio/periodo';
import { fechaYHoraLocal } from '../../lib/dominio/zona';
import type { CrearMisa, CrearPadre, QueryListarMisas } from './misas.schemas';

const SELECT_PADRE = { id: true, nombre: true } as const;

export async function listarPadres() {
  return prisma.padre.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: SELECT_PADRE,
  });
}

export async function crearPadre(datos: CrearPadre) {
  return prisma.padre.create({ data: { nombre: datos.nombre }, select: SELECT_PADRE });
}

/** Zona horaria de la iglesia; las fechas y horas de sus misas son locales (RN-31). */
async function zonaDe(iglesiaId: string) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return iglesia.zonaHoraria;
}

const aMisa = (
  zona: string,
  m: {
    id: string;
    inicio: Date;
    padre: { id: string; nombre: string };
    diezmo: { monto: { toFixed(d: number): string }; updatedAt: Date } | null;
  },
) => ({
  id: m.id,
  inicio: m.inicio,
  // Fecha y hora en la zona horaria de la iglesia: así se muestran (RN-31)
  fechaLocal: fechaYHoraLocal(m.inicio, zona).fecha,
  horaLocal: fechaYHoraLocal(m.inicio, zona).hora,
  padre: m.padre,
  diezmo: m.diezmo ? { monto: m.diezmo.monto.toFixed(2), actualizadoEn: m.diezmo.updatedAt } : null,
});

/** Registra una misa ya celebrada: un día, una hora y el padre que la ofició (RN-29, RF-48). */
export async function registrarMisa(iglesiaId: string, datos: CrearMisa) {
  const zona = await zonaDe(iglesiaId);
  const inicio = new Date(datos.inicio);
  if (inicio.getTime() > Date.now()) {
    throw AppError.reglaNegocio('Solo se registran misas que ya se celebraron.');
  }
  const padre = await prisma.padre.findFirst({
    where: { id: datos.padreId, activo: true },
    select: { id: true },
  });
  if (!padre) throw AppError.noEncontrado('El padre no existe.');
  const repetida = await prisma.misaCelebrada.findFirst({
    where: { iglesiaId, inicio },
    select: { id: true },
  });
  if (repetida) throw AppError.conflicto('Ya hay una misa registrada a esa hora en esta iglesia.');
  const misa = await prisma.misaCelebrada.create({
    data: { iglesiaId, inicio, padreId: padre.id },
    select: { id: true, inicio: true, padre: { select: SELECT_PADRE }, diezmo: true },
  });
  return aMisa(zona, misa);
}

/** Misas celebradas de la iglesia en un periodo (por omisión, el mes en curso), con su diezmo. */
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
      select: { id: true, inicio: true, padre: { select: SELECT_PADRE }, diezmo: true },
    }),
    prisma.misaCelebrada.count({ where }),
  ]);
  return { datos: misas.map((m) => aMisa(zona, m)), meta: crearMeta(total, page, limit) };
}
