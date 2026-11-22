/**
 * Service de donaciones y aportaciones (B4). Funciones para otros módulos:
 * - `resumen({ desde, hasta, agrupar })` → totales agrupados por día, semana, mes, concepto o método
 *   (dashboard y reporte de ingresos, B4).
 * - `totalDelMes(anio, mes)` → total del mes sin anuladas (dashboard).
 * - `detalleParaReporte({ desde, hasta })` → aportaciones sin paginar (reporte de ingresos).
 * Las anuladas nunca suman en ningún total. Los montos viajan como string "1500.00".
 */
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { crearMeta, ordenar, paginar } from '../../lib/paginacion';
import { iglesiaDelContexto } from '../../lib/contextoIglesia';
import { consultarDeIglesia, exigirMismaIglesia, prisma } from '../../lib/prisma';
import { periodosEntre } from '../asistencia/asistencia.service';
import type { Solicitante } from '../eventos/eventos.service';
import { aFechaApi, aFechaBd, existeActivo, hoyIglesia } from '../miembros/miembros.service';
import {
  type Agrupacion,
  CONCEPTOS,
  type CrearDonacion,
  type EditarDonacion,
  METODOS,
  type QueryDonaciones,
  type QueryResumen,
  type QueryResumenMensual,
} from './donaciones.schemas';

const NO_EXISTE = 'La aportación no existe.';
const DIA_MS = 86_400_000;

const SELECT_DONACION = {
  id: true,
  fecha: true,
  monto: true,
  concepto: true,
  conceptoDetalle: true,
  metodo: true,
  anonima: true,
  referencia: true,
  notas: true,
  anulada: true,
  motivoAnulacion: true,
  anuladaEn: true,
  createdAt: true,
  updatedAt: true,
  miembro: { select: { id: true, nombre: true, apellidos: true } },
  registradoPor: { select: { id: true, nombre: true } },
  actualizadoPor: { select: { id: true, nombre: true } },
} as const satisfies Prisma.DonacionSelect;

type DonacionBd = Prisma.DonacionGetPayload<{ select: typeof SELECT_DONACION }>;

// ───────── Dinero ─────────

/** Decimal / string / null → "1500.00" (siempre 2 decimales, sin pasar por number). */
export function formatoMonto(valor: Prisma.Decimal | string | null | undefined) {
  return new Prisma.Decimal(valor ?? 0).toFixed(2);
}

/** Variación porcentual con 1 decimal; null si el periodo anterior no tuvo ingresos. */
export function variacionPorcentual(actual: string, anterior: string) {
  const base = new Prisma.Decimal(anterior);
  if (base.isZero()) return null;
  return new Prisma.Decimal(actual).minus(base).div(base).times(100).toDecimalPlaces(1).toNumber();
}

function formatear(d: DonacionBd) {
  return { ...d, fecha: aFechaApi(d.fecha), monto: formatoMonto(d.monto) };
}

// ───────── Reglas comunes ─────────

/** La fecha de la aportación no puede ser posterior a hoy (en la zona horaria de la iglesia). */
async function verificarFechaNoFutura(fecha: string | undefined) {
  if (fecha && fecha > (await hoyIglesia())) {
    throw AppError.validacion('Los datos enviados no son válidos.', [
      { campo: 'fecha', mensaje: 'La fecha no puede ser futura.' },
    ]);
  }
}

/** El donante debe existir y estar activo → si no, 422. */
async function verificarDonante(miembroId: string | null | undefined) {
  // E1-06: donante de otra iglesia → 422 (con el filtro parecería no existir)
  await exigirMismaIglesia('miembro', [miembroId], 'miembroId');
  if (miembroId && !(await existeActivo(miembroId))) {
    throw AppError.reglaNegocio('El donante no existe o está inactivo.');
  }
}

async function obtenerOFallar(id: string) {
  const donacion = await prisma.donacion.findUnique({ where: { id }, select: SELECT_DONACION });
  if (!donacion) throw AppError.noEncontrado(NO_EXISTE);
  return donacion;
}

// ───────── CRUD (B4-01 … B4-04) ─────────

export async function crear(datos: CrearDonacion, solicitante: Solicitante) {
  await verificarFechaNoFutura(datos.fecha);
  await verificarDonante(datos.miembroId);
  const miembroId = datos.miembroId ?? null;
  const donacion = await prisma.donacion.create({
    data: {
      ...datos,
      fecha: aFechaBd(datos.fecha),
      monto: new Prisma.Decimal(datos.monto),
      miembroId,
      // Sin donante ⇒ anónima (specs.md §6)
      anonima: miembroId === null,
      registradoPorId: solicitante.id,
      iglesiaId: iglesiaDelContexto('Donacion'),
    },
    select: SELECT_DONACION,
  });
  return formatear(donacion);
}

function whereListado(query: QueryDonaciones): Prisma.DonacionWhereInput {
  return {
    ...(!query.incluirAnuladas && { anulada: false }),
    ...((query.desde || query.hasta) && {
      fecha: {
        ...(query.desde && { gte: aFechaBd(query.desde) }),
        ...(query.hasta && { lte: aFechaBd(query.hasta) }),
      },
    }),
    ...(query.concepto && { concepto: query.concepto }),
    ...(query.metodo && { metodo: query.metodo }),
    ...(query.miembroId && { miembroId: query.miembroId }),
    ...(query.anonima !== undefined && { anonima: query.anonima }),
  };
}

/** Paginado por fecha desc; `meta.totalMonto` suma el filtro completo sin anuladas. */
export async function listar(query: QueryDonaciones) {
  const { page, limit, skip, take } = paginar(query);
  const where = whereListado(query);
  const orderBy = [
    ordenar(query.orden, ['fecha', 'monto', 'createdAt'], { fecha: 'desc' }),
    { createdAt: 'desc' as const },
  ];
  const [filas, total, suma] = await Promise.all([
    prisma.donacion.findMany({ where, orderBy, skip, take, select: SELECT_DONACION }),
    prisma.donacion.count({ where }),
    prisma.donacion.aggregate({ where: { ...where, anulada: false }, _sum: { monto: true } }),
  ]);
  return {
    datos: filas.map(formatear),
    meta: { ...crearMeta(total, page, limit), totalMonto: formatoMonto(suma._sum.monto) },
  };
}

export async function obtener(id: string) {
  return formatear(await obtenerOFallar(id));
}

export async function editar(id: string, datos: EditarDonacion, solicitante: Solicitante) {
  const actual = await obtenerOFallar(id);
  if (actual.anulada) throw AppError.reglaNegocio('No se puede editar una aportación anulada.');
  await verificarFechaNoFutura(datos.fecha);

  const concepto = datos.concepto ?? actual.concepto;
  const conceptoDetalle =
    datos.conceptoDetalle !== undefined ? datos.conceptoDetalle : actual.conceptoDetalle;
  if (concepto === 'OTRO' && !conceptoDetalle) {
    throw AppError.validacion('Los datos enviados no son válidos.', [
      { campo: 'conceptoDetalle', mensaje: 'Describe el concepto cuando es "Otro".' },
    ]);
  }

  // Mismas reglas que al crear: marcar como anónima quita el donante; sin donante ⇒ anónima
  const miembroId =
    datos.anonima === true
      ? null
      : datos.miembroId !== undefined
        ? datos.miembroId
        : (actual.miembro?.id ?? null);
  if (datos.anonima === false && !miembroId) {
    throw AppError.validacion('Los datos enviados no son válidos.', [
      { campo: 'miembroId', mensaje: 'Elige el donante o marca la aportación como anónima.' },
    ]);
  }
  if (miembroId !== (actual.miembro?.id ?? null)) await verificarDonante(miembroId);

  const { fecha, monto, anonima: _anonima, miembroId: _miembroId, ...resto } = datos;
  const donacion = await prisma.donacion.update({
    where: { id },
    data: {
      ...resto,
      ...(fecha && { fecha: aFechaBd(fecha) }),
      ...(monto && { monto: new Prisma.Decimal(monto) }),
      miembroId,
      anonima: miembroId === null,
      actualizadoPorId: solicitante.id,
    },
    select: SELECT_DONACION,
  });
  return formatear(donacion);
}

/** No existe DELETE: se anula con motivo y deja de sumar en todos los totales (B4-04). */
export async function anular(id: string, motivo: string, solicitante: Solicitante) {
  const actual = await obtenerOFallar(id);
  if (actual.anulada) throw AppError.reglaNegocio('La aportación ya está anulada.');
  const donacion = await prisma.donacion.update({
    where: { id },
    data: {
      anulada: true,
      motivoAnulacion: motivo,
      anuladaEn: new Date(),
      actualizadoPorId: solicitante.id,
    },
    select: SELECT_DONACION,
  });
  return formatear(donacion);
}

// ───────── Fechas de calendario ("yyyy-MM-dd") ─────────

const sumarDias = (fecha: string, dias: number) =>
  new Date(aFechaBd(fecha).getTime() + dias * DIA_MS).toISOString().slice(0, 10);

/** Primer día del mes `meses` antes (o después, si es negativo) del mes de `fecha`. */
export function inicioMes(fecha: string, meses = 0) {
  const d = new Date(`${fecha.slice(0, 7)}-01T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().slice(0, 10);
}

/** Último día del mes de `fecha`. */
export function finMes(fecha: string) {
  return sumarDias(inicioMes(fecha, -1), -1);
}

function diasEntre(desde: string, hasta: string) {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

/** Claves de todos los grupos (serie continua: periodos y valores del enum sin datos van en cero). */
function clavesDe(agrupar: Agrupacion, desde: string, hasta: string): readonly string[] {
  switch (agrupar) {
    case 'dia':
      return diasEntre(desde, hasta);
    case 'semana':
      return periodosEntre('semanal', desde, hasta);
    case 'mes':
      return periodosEntre('mensual', desde, hasta);
    case 'concepto':
      return CONCEPTOS;
    case 'metodo':
      return METODOS;
  }
}

function expresionGrupo(agrupar: Agrupacion) {
  switch (agrupar) {
    case 'dia':
      return Prisma.sql`to_char(fecha, 'YYYY-MM-DD')`;
    case 'semana':
      return Prisma.sql`to_char(fecha, 'IYYY-"W"IW')`;
    case 'mes':
      return Prisma.sql`to_char(fecha, 'YYYY-MM')`;
    case 'concepto':
      return Prisma.sql`concepto::text`;
    case 'metodo':
      return Prisma.sql`metodo::text`;
  }
}

// ───────── Resúmenes (B4-05, B4-06) ─────────

/**
 * Totales de aportaciones no anuladas entre dos fechas (días completos), agrupados.
 * La suma la hace PostgreSQL sobre NUMERIC: 0.10 + 0.20 = "0.30" exacto.
 */
export async function resumenEntre(desde: string, hasta: string, agrupar: Agrupacion) {
  const grupo = expresionGrupo(agrupar);
  const filas = await consultarDeIglesia<{ clave: string; total: string; cantidad: bigint }[]>(
    (iglesiaId) => Prisma.sql`
      SELECT ${grupo} AS clave, SUM(monto)::text AS total, COUNT(*) AS cantidad
      FROM donaciones
      WHERE "iglesiaId" = ${iglesiaId}
        AND NOT anulada AND fecha >= ${desde}::date AND fecha <= ${hasta}::date
      GROUP BY 1`,
  );
  const porClave = new Map(filas.map((f) => [f.clave, f]));
  const grupos = clavesDe(agrupar, desde, hasta).map((clave) => {
    const f = porClave.get(clave);
    return { clave, total: formatoMonto(f?.total), cantidad: Number(f?.cantidad ?? 0) };
  });
  const total = filas.reduce((suma, f) => suma.plus(f.total), new Prisma.Decimal(0));
  return {
    desde,
    hasta,
    agrupar,
    total: total.toFixed(2),
    cantidad: filas.reduce((suma, f) => suma + Number(f.cantidad), 0),
    grupos,
  };
}

/** Endpoint: sin fechas, el mes en curso (del día 1 a hoy, en la zona horaria de la iglesia). */
export async function resumen(query: QueryResumen) {
  const hoy = await hoyIglesia();
  const hasta = query.hasta ?? (query.desde && query.desde > hoy ? query.desde : hoy);
  const desde = query.desde ?? inicioMes(hasta);
  return resumenEntre(desde, hasta, query.agrupar);
}

/** Total del mes (sin anuladas) como string. */
export async function totalDelMes(anio: number, mes: number) {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const suma = await prisma.donacion.aggregate({
    where: { anulada: false, fecha: { gte: aFechaBd(desde), lte: aFechaBd(finMes(desde)) } },
    _sum: { monto: true },
  });
  return formatoMonto(suma._sum.monto);
}

/** Resumen de un mes: total, comparación con el anterior, desgloses y anónimas vs. identificadas. */
export async function resumenMensual(query: QueryResumenMensual) {
  const hoy = await hoyIglesia();
  const anio = query.anio ?? Number(hoy.slice(0, 4));
  const mes = query.mes ?? Number(hoy.slice(5, 7));
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const hasta = finMes(desde);
  const anterior = inicioMes(desde, 1);

  const [porConcepto, porMetodo, totalAnterior, anonimas] = await Promise.all([
    resumenEntre(desde, hasta, 'concepto'),
    resumenEntre(desde, hasta, 'metodo'),
    totalDelMes(Number(anterior.slice(0, 4)), Number(anterior.slice(5, 7))),
    prisma.donacion.groupBy({
      by: ['anonima'],
      where: { anulada: false, fecha: { gte: aFechaBd(desde), lte: aFechaBd(hasta) } },
      _sum: { monto: true },
      _count: { _all: true },
    }),
  ]);
  const grupoAnonimo = (anonima: boolean) => {
    const g = anonimas.find((a) => a.anonima === anonima);
    return { cantidad: g?._count._all ?? 0, total: formatoMonto(g?._sum.monto) };
  };
  return {
    anio,
    mes,
    desde,
    hasta,
    total: porConcepto.total,
    cantidad: porConcepto.cantidad,
    mesAnterior: {
      anio: Number(anterior.slice(0, 4)),
      mes: Number(anterior.slice(5, 7)),
      total: totalAnterior,
    },
    variacionPorcentual: variacionPorcentual(porConcepto.total, totalAnterior),
    porConcepto: porConcepto.grupos,
    porMetodo: porMetodo.grupos,
    anonimas: grupoAnonimo(true),
    identificadas: grupoAnonimo(false),
  };
}

// ───────── Funciones para reportes (B4-10) ─────────

/** Aportaciones no anuladas del rango, sin paginar, en orden cronológico. */
export async function detalleParaReporte(desde: string, hasta: string) {
  const filas = await prisma.donacion.findMany({
    where: { anulada: false, fecha: { gte: aFechaBd(desde), lte: aFechaBd(hasta) } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    select: SELECT_DONACION,
  });
  return filas.map(formatear);
}
