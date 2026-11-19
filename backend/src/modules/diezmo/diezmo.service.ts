// Diezmo de las misas (RF-60–RF-69, RN-40–RN-46). Toda la lógica y el único acceso a la BD.
// Las reglas puras viven en dominio/; aquí se arma el contexto (BD, ahora) y se traducen los
// resultados a AppError. Las sumas y las agrupaciones se hacen en SQL sobre Decimal(12,2).
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { type PeriodoReporte, resolverPeriodo } from '../../lib/dominio/periodo';
import { fechaYHoraLocal } from '../../lib/dominio/zona';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import { type MotivoCaptura, evaluarCaptura, evaluarCorreccion } from './dominio/captura';
import { aCentavos, deCentavos } from './dominio/dinero';
import { SUPUESTOS_DIEZMO } from './dominio/supuestos';
import type { QueryAgrupado, QueryListarDiezmos, QueryPeriodo } from './diezmo.schemas';

const SELECT_USUARIO = { id: true, nombre: true } as const;
const SELECT_PADRE = { id: true, nombre: true } as const;

const SELECT_DIEZMO = {
  id: true,
  misaId: true,
  monto: true,
  createdAt: true,
  updatedAt: true,
  capturadoPor: { select: SELECT_USUARIO },
  // Historial: la más reciente primero (RN-43)
  correcciones: {
    orderBy: [{ hechaEn: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      montoAnterior: true,
      montoNuevo: true,
      hechaEn: true,
      hechaPor: { select: SELECT_USUARIO },
    },
  },
} satisfies Prisma.DiezmoSelect;

type DiezmoConHistorial = Prisma.DiezmoGetPayload<{ select: typeof SELECT_DIEZMO }>;

// El dinero viaja siempre como texto con 2 decimales (AGENTS.md §3)
const dinero = (monto: Prisma.Decimal) => monto.toFixed(2);

function aDiezmo(d: DiezmoConHistorial) {
  return {
    id: d.id,
    misaId: d.misaId,
    monto: dinero(d.monto),
    capturadoPor: d.capturadoPor,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    correcciones: d.correcciones.map((c) => ({
      id: c.id,
      montoAnterior: dinero(c.montoAnterior),
      montoNuevo: dinero(c.montoNuevo),
      hechaPor: c.hechaPor,
      hechaEn: c.hechaEn,
    })),
  };
}

const errorMonto = () =>
  AppError.validacion('El monto no es válido.', [
    {
      campo: 'monto',
      mensaje: 'Escribe un monto válido, con hasta 2 decimales (por ejemplo 1250.50).',
    },
  ]);

function errorDeCaptura(motivo: MotivoCaptura): AppError {
  switch (motivo) {
    case 'MONTO_INVALIDO':
      return errorMonto();
    case 'MISA_NO_CELEBRADA':
      return AppError.reglaNegocio('Solo se captura el diezmo de una misa que ya se celebró.');
    case 'YA_TIENE_CAPTURA':
      return AppError.conflicto(
        'Esta misa ya tiene diezmo capturado. Corrígelo en lugar de capturarlo otra vez.',
      );
  }
}

/** Zona horaria de la iglesia: los periodos y las agrupaciones son en su hora local (RN-31). */
async function zonaDe(iglesiaId: string): Promise<string> {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return iglesia.zonaHoraria;
}

async function periodoDe(
  iglesiaId: string,
  q: QueryPeriodo,
): Promise<{ zona: string; periodo: PeriodoReporte }> {
  const zona = await zonaDe(iglesiaId);
  const r = resolverPeriodo(q.desde, q.hasta, zona, new Date());
  if (!r.ok) {
    throw AppError.validacion('El periodo no es válido.', [
      {
        campo: 'desde',
        mensaje:
          r.motivo === 'RANGO_INVERTIDO'
            ? 'La fecha inicial no puede ser posterior a la final.'
            : 'Usa fechas reales con el formato aaaa-mm-dd.',
      },
    ]);
  }
  return { zona, periodo: r.periodo };
}

// ───────────── Captura y corrección ─────────────

/** RF-60, RF-61: captura el diezmo de una misa celebrada de la iglesia; una sola vez por misa. */
export async function capturar(
  iglesiaId: string,
  misaId: string,
  monto: string,
  usuarioId: string,
) {
  // La misa se busca dentro de la iglesia: una misa de otra iglesia es "no existe" (RNF-10)
  const misa = await prisma.misaCelebrada.findFirst({
    where: { id: misaId, iglesiaId },
    select: { inicio: true, diezmo: { select: { id: true } } },
  });
  if (!misa) throw AppError.noEncontrado('La misa no existe en esta iglesia.');

  // Una misa registrada en la BD es una misa con celebración registrada (P-22)
  const r = evaluarCaptura(
    { inicio: misa.inicio, celebracionRegistrada: true },
    monto,
    misa.diezmo !== null,
    new Date(),
  );
  if (!r.ok) throw errorDeCaptura(r.motivo);

  try {
    const creado = await prisma.diezmo.create({
      data: { misaId, iglesiaId, monto: r.monto, capturadoPorId: usuarioId },
      select: SELECT_DIEZMO,
    });
    return aDiezmo(creado);
  } catch (error) {
    // Dos capturas a la vez: la restricción única de la BD deja pasar solo una (RN-41)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw errorDeCaptura('YA_TIENE_CAPTURA');
    }
    throw error;
  }
}

/** RF-63: la captura vigente con su historial de correcciones. */
export async function obtener(iglesiaId: string, misaId: string) {
  const diezmo = await prisma.diezmo.findFirst({
    where: { misaId, iglesiaId },
    select: SELECT_DIEZMO,
  });
  if (!diezmo) throw AppError.noEncontrado('Esta misa todavía no tiene diezmo capturado.');
  return aDiezmo(diezmo);
}

/** RF-62, RF-63: corrige el monto y guarda quién, cuándo y la cantidad anterior, en una transacción. */
export async function corregir(
  iglesiaId: string,
  misaId: string,
  monto: string,
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.diezmo.findFirst({
      where: { misaId, iglesiaId },
      select: { id: true, monto: true },
    });
    if (!actual) throw AppError.noEncontrado('Esta misa todavía no tiene diezmo capturado.');

    const r = evaluarCorreccion(dinero(actual.monto), monto, usuarioId, new Date());
    if (!r.ok) {
      throw r.motivo === 'MONTO_INVALIDO'
        ? errorMonto()
        : AppError.reglaNegocio('El monto es el mismo que ya está capturado.');
    }

    // Compara y cambia en un solo paso: si otra corrección llegó primero, no se pisa
    const { count } = await tx.diezmo.updateMany({
      where: { id: actual.id, monto: actual.monto },
      data: { monto: r.correccion.nuevo },
    });
    if (count !== 1) {
      throw AppError.conflicto('El diezmo cambió mientras lo corregías. Ábrelo de nuevo.');
    }
    await tx.diezmoCorreccion.create({
      data: {
        diezmoId: actual.id,
        montoAnterior: r.correccion.anterior,
        montoNuevo: r.correccion.nuevo,
        hechaPorId: usuarioId,
        hechaEn: r.correccion.hechaEn,
      },
    });
    return aDiezmo(
      await tx.diezmo.findUniqueOrThrow({ where: { id: actual.id }, select: SELECT_DIEZMO }),
    );
  });
}

// ───────────── Consultas y reportes ─────────────

/** RF-64: capturas del periodo, la más reciente primero. */
export async function listar(iglesiaId: string, query: QueryListarDiezmos) {
  const { zona, periodo } = await periodoDe(iglesiaId, query);
  const { page, limit, skip, take } = paginar(query);
  const where: Prisma.DiezmoWhereInput = {
    iglesiaId,
    misa: { inicio: { gte: periodo.inicio, lt: periodo.finExcluido } },
  };
  const [filas, total] = await Promise.all([
    prisma.diezmo.findMany({
      where,
      orderBy: [{ misa: { inicio: 'desc' } }, { id: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        misaId: true,
        monto: true,
        updatedAt: true,
        misa: { select: { inicio: true, padre: { select: SELECT_PADRE } } },
      },
    }),
    prisma.diezmo.count({ where }),
  ]);
  const datos = filas.map((f) => ({
    id: f.id,
    misaId: f.misaId,
    inicio: f.misa.inicio,
    fechaLocal: fechaYHoraLocal(f.misa.inicio, zona).fecha,
    horaLocal: fechaYHoraLocal(f.misa.inicio, zona).hora,
    padre: f.misa.padre,
    monto: dinero(f.monto),
    actualizadoEn: f.updatedAt,
  }));
  return { datos, meta: crearMeta(total, page, limit) };
}

/** RF-64, RF-65, RN-45: total, promedio por misa y misas con más y con menos diezmo. */
export async function resumen(iglesiaId: string, query: QueryPeriodo) {
  const { zona, periodo } = await periodoDe(iglesiaId, query);
  const rango = Prisma.sql`m."inicio" >= ${periodo.inicio} AND m."inicio" < ${periodo.finExcluido}`;

  const [fila] = await prisma.$queryRaw<
    { misas: number; total: string; promedio: string | null }[]
  >(
    Prisma.sql`
      SELECT COUNT(*)::int AS misas,
             COALESCE(SUM(d."monto"), 0)::text AS total,
             CASE WHEN COUNT(*) = 0 THEN NULL
                  ELSE ROUND(SUM(d."monto") / COUNT(*), 2)::text END AS promedio
      FROM "diezmos" d
      JOIN "misas_celebradas" m ON m."id" = d."misaId"
      WHERE d."iglesiaId" = ${iglesiaId} AND ${rango}`,
  );

  // Extremos: con empate gana la misa más antigua (supuesto P-23)
  const donde: Prisma.DiezmoWhereInput = {
    iglesiaId,
    misa: { inicio: { gte: periodo.inicio, lt: periodo.finExcluido } },
  };
  const extremas = (monto: 'asc' | 'desc') =>
    prisma.diezmo.findMany({
      where: donde,
      orderBy: [{ monto }, { misa: { inicio: 'asc' } }, { misaId: 'asc' }],
      take: SUPUESTOS_DIEZMO.cuantasMisasExtremas,
      select: { misaId: true, monto: true, misa: { select: { inicio: true } } },
    });
  const aMisa = (d: { misaId: string; monto: Prisma.Decimal; misa: { inicio: Date } }) => ({
    misaId: d.misaId,
    inicio: d.misa.inicio,
    fechaLocal: fechaYHoraLocal(d.misa.inicio, zona).fecha,
    horaLocal: fechaYHoraLocal(d.misa.inicio, zona).hora,
    monto: dinero(d.monto),
  });
  const [conMas, conMenos] = await Promise.all([extremas('desc'), extremas('asc')]);

  return {
    desde: periodo.desde,
    hasta: periodo.hasta,
    misas: fila?.misas ?? 0,
    total: deCentavos(aCentavos(fila?.total ?? '0')),
    promedio: fila?.promedio ? deCentavos(aCentavos(fila.promedio)) : null,
    conMas: conMas.map(aMisa),
    conMenos: conMenos.map(aMisa),
  };
}

/** RF-66–RF-68: diezmo por día, semana, mes, horario de misa o padre, en la hora local de la iglesia. */
export async function agrupado(iglesiaId: string, query: QueryAgrupado) {
  const { zona, periodo } = await periodoDe(iglesiaId, query);
  // Los instantes se guardan en UTC (sin zona): primero se leen como UTC y luego se pasan a la hora local
  const local = Prisma.sql`((m."inicio" AT TIME ZONE 'UTC') AT TIME ZONE ${zona})`;
  const semana =
    SUPUESTOS_DIEZMO.inicioDeSemana === 1
      ? Prisma.sql`date_trunc('week', ${local})`
      : Prisma.sql`(date_trunc('week', ${local} + interval '1 day') - interval '1 day')`;
  const clave = {
    dia: Prisma.sql`to_char(${local}, 'YYYY-MM-DD')`,
    semana: Prisma.sql`to_char(${semana}, 'YYYY-MM-DD')`,
    mes: Prisma.sql`to_char(${local}, 'YYYY-MM')`,
    horario: Prisma.sql`to_char(${local}, 'HH24:MI')`,
    padre: Prisma.sql`m."padreId"`,
  }[query.por];

  const filas = await prisma.$queryRaw<
    { clave: string; etiqueta: string | null; misas: number; total: string }[]
  >(
    Prisma.sql`
      SELECT ${clave} AS clave,
             MIN(p."nombre") AS etiqueta,
             COUNT(*)::int AS misas,
             SUM(d."monto")::text AS total
      FROM "diezmos" d
      JOIN "misas_celebradas" m ON m."id" = d."misaId"
      JOIN "padres" p ON p."id" = m."padreId"
      WHERE d."iglesiaId" = ${iglesiaId}
        AND m."inicio" >= ${periodo.inicio} AND m."inicio" < ${periodo.finExcluido}
      GROUP BY 1
      ORDER BY 1`,
  );

  const grupos = filas.map((f) => ({
    clave: f.clave,
    etiqueta: query.por === 'padre' ? (f.etiqueta ?? f.clave) : f.clave,
    misas: f.misas,
    total: deCentavos(aCentavos(f.total)),
  }));
  // Los padres se ordenan por nombre; el resto, por su clave (fecha u hora)
  if (query.por === 'padre') grupos.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  return { desde: periodo.desde, hasta: periodo.hasta, por: query.por, grupos };
}
