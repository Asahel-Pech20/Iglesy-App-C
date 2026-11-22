/**
 * Reportes (B4-10 … B4-13). Arman un `Reporte` común (lib/exportadores) con datos de los services
 * dueños: miembros y ministerios (B2), eventos y asistencia (B3), donaciones (B4).
 * El COORDINADOR (`reportes:generales-propio`) solo ve los ministerios que coordina.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env';
import { tienePermiso } from '../../config/permisos';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import type { Celda, ContextoReporte, Dato, Reporte } from '../../lib/exportadores/reporte';
import { consultarDeIglesia } from '../../lib/prisma';
import * as asistenciaService from '../asistencia/asistencia.service';
import * as configuracionService from '../configuracion/configuracion.service';
import * as donacionesService from '../donaciones/donaciones.service';
import type { Agrupacion } from '../donaciones/donaciones.schemas';
import { finDiaEnZona, inicioDiaEnZona } from '../eventos/eventos.fechas';
import type { Solicitante } from '../eventos/eventos.service';
import * as miembrosService from '../miembros/miembros.service';
import * as ministeriosService from '../ministerios/ministerios.service';
import type {
  QueryReporteAsistencia,
  QueryReporteIngresos,
  QueryReporteMiembros,
  QueryReporteMinisterios,
} from './reportes.schemas';

export interface Generador extends Solicitante {
  nombre: string;
}

const SOLO_PROPIOS = 'Solo puedes generar reportes de los ministerios que coordinas.';

export const ETIQUETAS_CONCEPTO: Record<string, string> = {
  DIEZMO: 'Diezmo',
  OFRENDA: 'Ofrenda',
  PRIMICIA: 'Primicia',
  DONACION_ESPECIAL: 'Donación especial',
  OTRO: 'Otro',
};

export const ETIQUETAS_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

const ETIQUETAS_AGRUPAR: Record<Agrupacion, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  concepto: 'Concepto',
  metodo: 'Método',
};

const redondear1 = (valor: number) => Math.round(valor * 10) / 10;
const porcentaje = (presentes: number, total: number) =>
  total > 0 ? redondear1((presentes / total) * 100) : null;

// ───────── Contexto y alcance ─────────

/** Nombre, moneda, zona horaria y ruta en disco del logotipo (solo PNG/JPG: PDFKit no lee SVG ni WebP). */
export async function contexto(): Promise<ContextoReporte> {
  const config = await configuracionService.obtener();
  let logo: string | null = null;
  if (config.logoUrl) {
    const archivo = path.resolve(env.UPLOAD_DIR, path.basename(new URL(config.logoUrl).pathname));
    if (/\.(png|jpe?g)$/i.test(archivo) && existsSync(archivo)) logo = archivo;
  }
  return {
    nombreIglesia: config.nombre,
    moneda: config.moneda,
    zonaHoraria: config.zonaHoraria,
    logo,
  };
}

/** `null` = sin límite; para el COORDINADOR, los ministerios que coordina. */
async function alcance(solicitante: Solicitante) {
  if (tienePermiso(solicitante.rol, 'reportes:generales')) return null;
  return ministeriosService.ministeriosCoordinadosPor(solicitante.id);
}

function base(
  tipo: Reporte['tipo'],
  titulo: string,
  generador: Generador,
): Pick<Reporte, 'tipo' | 'titulo' | 'generadoEn' | 'generadoPor'> {
  return { tipo, titulo, generadoEn: new Date().toISOString(), generadoPor: generador.nombre };
}

/** Rango por defecto: del día 1 de hace `meses` meses hasta hoy (zona horaria de la iglesia). */
async function rangoPorDefecto(q: { desde?: string; hasta?: string }, meses: number) {
  const hoy = await miembrosService.hoyIglesia();
  const hasta = q.hasta ?? (q.desde && q.desde > hoy ? q.desde : hoy);
  return { desde: q.desde ?? donacionesService.inicioMes(hasta, meses), hasta };
}

/** "2026-10" → "octubre 2026"; "2026-W43" → "Semana 43 de 2026"; "2026-10-30" → "30/10/2026". */
export function etiquetaPeriodo(clave: string) {
  const semana = /^(\d{4})-W(\d{2})$/.exec(clave);
  if (semana) return `Semana ${Number(semana[2])} de ${semana[1]}`;
  if (/^\d{4}-\d{2}$/.test(clave)) {
    return new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${clave}-01T00:00:00.000Z`));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clave)) return clave.split('-').reverse().join('/');
  return ETIQUETAS_CONCEPTO[clave] ?? ETIQUETAS_METODO[clave] ?? clave;
}

const rangoTexto = (desde: string, hasta: string): Dato[] => [
  { etiqueta: 'Desde', valor: desde, tipo: 'fecha' },
  { etiqueta: 'Hasta', valor: hasta, tipo: 'fecha' },
];

// ───────── RF-09.1 · Miembros (B4-11) ─────────

/** Colación en español (acentos y ñ en su lugar), independiente de la BD. */
const ORDEN_ES = new Intl.Collator('es', { sensitivity: 'base' });

const ESTADOS: Record<QueryReporteMiembros['estado'], string> = {
  activo: 'Activos',
  inactivo: 'Inactivos',
  todos: 'Todos',
};

export async function miembros(
  query: QueryReporteMiembros,
  generador: Generador,
): Promise<Reporte> {
  const ministerios = await alcance(generador);
  let filas = await miembrosService.listadoParaReporte({ estado: query.estado });
  if (ministerios) {
    // Coordinador: integrantes activos de sus ministerios
    const integrantes = await Promise.all(
      ministerios.map((id) => ministeriosService.miembrosDe(id)),
    );
    const ids = new Set(integrantes.flat().map((m) => m.id));
    filas = filas.filter((m) => ids.has(m.id));
  }
  // El orden de la BD depende de su collation (en postgres:16-alpine "Á" va después de "Z"):
  // se ordena aquí, en español, para que el reporte sea igual en cualquier entorno
  filas = filas.sort(
    (a, b) => ORDEN_ES.compare(a.apellidos, b.apellidos) || ORDEN_ES.compare(a.nombre, b.nombre),
  );
  const anio = (await miembrosService.hoyIglesia()).slice(0, 4);
  const activos = filas.filter((m) => m.activo).length;
  return {
    ...base('miembros', 'Reporte general de miembros', generador),
    filtros: [{ etiqueta: 'Estado', valor: ESTADOS[query.estado] }],
    resumen: [
      { etiqueta: 'Miembros', valor: filas.length, tipo: 'numero' },
      { etiqueta: 'Activos', valor: activos, tipo: 'numero' },
      { etiqueta: 'Inactivos', valor: filas.length - activos, tipo: 'numero' },
      {
        etiqueta: `Altas en ${anio}`,
        valor: filas.filter((m) => m.fechaIngreso.startsWith(anio)).length,
        tipo: 'numero',
      },
    ],
    secciones: [
      {
        titulo: 'Miembros',
        columnas: [
          { clave: 'nombre', titulo: 'Nombre', ancho: 2 },
          { clave: 'telefono', titulo: 'Teléfono', ancho: 1.2 },
          { clave: 'email', titulo: 'Correo', ancho: 2 },
          { clave: 'fechaIngreso', titulo: 'Ingreso', tipo: 'fecha' },
          { clave: 'estado', titulo: 'Estado', ancho: 0.8 },
          { clave: 'ministerios', titulo: 'Ministerios', ancho: 2 },
        ],
        filas: filas.map((m) => ({
          nombre: `${m.apellidos}, ${m.nombre}`,
          telefono: m.telefono,
          email: m.email,
          fechaIngreso: m.fechaIngreso,
          estado: m.activo ? 'Activo' : 'Inactivo',
          ministerios: m.ministerios.join(', ') || null,
        })),
      },
    ],
  };
}

// ───────── RF-09.2 / RF-03.5 · Asistencia (B4-12) ─────────

async function asistenciaDeEvento(eventoId: string, generador: Generador): Promise<Reporte> {
  const detalle = await asistenciaService.porEvento(eventoId);
  const ministerios = await alcance(generador);
  const ministerioId = detalle.evento.ministerio?.id;
  if (ministerios && (!ministerioId || !ministerios.includes(ministerioId))) {
    throw AppError.prohibido(SOLO_PROPIOS);
  }
  const { evento } = detalle;
  const ctx = await contexto();
  const cuando = new Intl.DateTimeFormat('es-MX', {
    timeZone: ctx.zonaHoraria,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(evento.fechaInicio);
  return {
    ...base('asistencia', `Asistencia: ${evento.titulo}`, generador),
    subtitulo: `${cuando} · ${evento.lugar}${evento.ministerio ? ` · ${evento.ministerio.nombre}` : ''}`,
    filtros: [{ etiqueta: 'Evento', valor: evento.titulo }],
    resumen: [
      { etiqueta: 'Presentes', valor: detalle.presentes, tipo: 'numero' },
      { etiqueta: 'Ausentes', valor: detalle.ausentes, tipo: 'numero' },
      { etiqueta: 'Asistencia', valor: detalle.porcentaje, tipo: 'porcentaje' },
    ],
    secciones: [
      {
        titulo: 'Pase de lista',
        columnas: [
          { clave: 'miembro', titulo: 'Miembro', ancho: 2.5 },
          { clave: 'asistencia', titulo: 'Asistencia' },
          { clave: 'registradoEn', titulo: 'Registrado', tipo: 'fechaHora', ancho: 1.3 },
        ],
        filas: detalle.registros.map((r) => ({
          miembro: `${r.miembro.apellidos}, ${r.miembro.nombre}`,
          asistencia: r.presente ? 'Presente' : 'Ausente',
          registradoEn: r.registradoEn.toISOString(),
        })),
        totales: {
          miembro: 'Total',
          asistencia: `${detalle.presentes} de ${detalle.registros.length}`,
        },
      },
    ],
  };
}

/** Eventos no cancelados del rango con sus totales de asistencia (consulta de solo lectura). */
async function eventosConAsistencia(desde: Date, hasta: Date, ministerios: string[] | null) {
  const filtro = ministerios
    ? Prisma.sql`AND e."ministerioId" = ANY(${ministerios}::text[])`
    : Prisma.empty;
  const filas = await consultarDeIglesia<
    {
      titulo: string;
      fechaInicio: Date;
      ministerio: string | null;
      presentes: bigint;
      ausentes: bigint;
    }[]
  >(
    (iglesiaId) => Prisma.sql`
    SELECT e.titulo, e."fechaInicio", m.nombre AS ministerio,
           COUNT(a.id) FILTER (WHERE a.presente) AS presentes,
           COUNT(a.id) FILTER (WHERE NOT a.presente) AS ausentes
    FROM eventos e
    LEFT JOIN ministerios m ON m.id = e."ministerioId"
    LEFT JOIN asistencias a ON a."eventoId" = e.id
    WHERE e."iglesiaId" = ${iglesiaId}
      AND e.estado <> 'CANCELADO' AND e."fechaInicio" >= ${desde} AND e."fechaInicio" < ${hasta}
      ${filtro}
    GROUP BY e.id, m.nombre
    ORDER BY e."fechaInicio"`,
  );
  return filas.map((f) => {
    const presentes = Number(f.presentes);
    const ausentes = Number(f.ausentes);
    return {
      fecha: f.fechaInicio.toISOString(),
      evento: f.titulo,
      ministerio: f.ministerio,
      presentes,
      ausentes,
      porcentaje: porcentaje(presentes, presentes + ausentes),
    };
  });
}

export async function asistencia(
  query: QueryReporteAsistencia,
  generador: Generador,
): Promise<Reporte> {
  if (query.eventoId) return asistenciaDeEvento(query.eventoId, generador);

  const { desde, hasta } = await rangoPorDefecto(query, 2);
  const ministerios = await alcance(generador);
  const { zonaHoraria } = await configuracionService.obtener();
  const [serie, eventos] = await Promise.all([
    asistenciaService.resumenPorPeriodo(query.periodo, desde, hasta, ministerios),
    eventosConAsistencia(
      inicioDiaEnZona(desde, zonaHoraria),
      finDiaEnZona(hasta, zonaHoraria),
      ministerios,
    ),
  ]);
  const presentes = serie.reduce((s, p) => s + p.presentes, 0);
  const ausentes = serie.reduce((s, p) => s + p.ausentes, 0);
  const totalEventos = serie.reduce((s, p) => s + p.eventos, 0);
  const etiqueta = query.periodo === 'semanal' ? 'semanal' : 'mensual';
  return {
    ...base('asistencia', `Reporte ${etiqueta} de asistencia`, generador),
    filtros: [
      ...rangoTexto(desde, hasta),
      { etiqueta: 'Periodo', valor: query.periodo === 'semanal' ? 'Semanal' : 'Mensual' },
      ...(ministerios ? [{ etiqueta: 'Alcance', valor: 'Ministerios que coordinas' }] : []),
    ],
    resumen: [
      { etiqueta: 'Eventos con asistencia', valor: totalEventos, tipo: 'numero' },
      { etiqueta: 'Presentes', valor: presentes, tipo: 'numero' },
      { etiqueta: 'Ausentes', valor: ausentes, tipo: 'numero' },
      {
        etiqueta: 'Asistencia',
        valor: porcentaje(presentes, presentes + ausentes),
        tipo: 'porcentaje',
      },
    ],
    secciones: [
      {
        titulo: query.periodo === 'semanal' ? 'Resumen semanal' : 'Resumen mensual',
        columnas: [
          { clave: 'periodo', titulo: 'Periodo', ancho: 1.6 },
          { clave: 'eventos', titulo: 'Eventos', tipo: 'numero' },
          { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
          { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
          { clave: 'promedioPorEvento', titulo: 'Promedio por evento', tipo: 'numero' },
        ],
        filas: serie.map((p) => ({
          periodo: etiquetaPeriodo(p.periodo),
          eventos: p.eventos,
          presentes: p.presentes,
          ausentes: p.ausentes,
          promedioPorEvento: p.promedioPorEvento,
        })),
        totales: { periodo: 'Total', eventos: totalEventos, presentes, ausentes },
      },
      {
        titulo: 'Eventos',
        columnas: [
          { clave: 'fecha', titulo: 'Fecha', tipo: 'fechaHora', ancho: 1.3 },
          { clave: 'evento', titulo: 'Evento', ancho: 2.2 },
          { clave: 'ministerio', titulo: 'Ministerio', ancho: 1.4 },
          { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
          { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
          { clave: 'porcentaje', titulo: '% asistencia', tipo: 'porcentaje' },
        ],
        filas: eventos,
      },
    ],
  };
}

// ───────── RF-09.3 · Participación por ministerio (B4-13) ─────────

/** Presentes / ausentes de cada miembro en los eventos de un ministerio (solo lectura). */
async function asistenciaPorIntegrante(ministerioId: string, desde: Date, hasta: Date) {
  const filas = await consultarDeIglesia<
    { miembroId: string; presentes: bigint; ausentes: bigint }[]
  >(
    (iglesiaId) => Prisma.sql`
    SELECT a."miembroId" AS "miembroId",
           COUNT(*) FILTER (WHERE a.presente) AS presentes,
           COUNT(*) FILTER (WHERE NOT a.presente) AS ausentes
    FROM asistencias a
    JOIN eventos e ON e.id = a."eventoId"
    WHERE e."iglesiaId" = ${iglesiaId}
      AND e."ministerioId" = ${ministerioId} AND e.estado <> 'CANCELADO'
      AND e."fechaInicio" >= ${desde} AND e."fechaInicio" < ${hasta}
    GROUP BY a."miembroId"`,
  );
  return new Map(
    filas.map((f) => [
      f.miembroId,
      { presentes: Number(f.presentes), ausentes: Number(f.ausentes) },
    ]),
  );
}

async function coordinadoresPorMinisterio() {
  const { datos } = await ministeriosService.listar({ page: 1, limit: 100, activo: true });
  return new Map(datos.map((m) => [m.id, m.coordinadores.map((c) => c.nombre).join(', ')]));
}

export async function ministerios(
  query: QueryReporteMinisterios,
  generador: Generador,
): Promise<Reporte> {
  const { desde, hasta } = await rangoPorDefecto(query, 2);
  const permitidos = await alcance(generador);
  if (query.ministerioId && permitidos && !permitidos.includes(query.ministerioId)) {
    throw AppError.prohibido(SOLO_PROPIOS);
  }
  const { zonaHoraria } = await configuracionService.obtener();
  const inicio = inicioDiaEnZona(desde, zonaHoraria);
  const fin = finDiaEnZona(hasta, zonaHoraria);
  const [participacion, coordinadores] = await Promise.all([
    asistenciaService.participacionPorMinisterio(inicio, fin),
    coordinadoresPorMinisterio(),
  ]);
  const filtros = rangoTexto(desde, hasta);

  if (query.ministerioId) {
    const ministerio = await ministeriosService.obtener(query.ministerioId);
    const [integrantes, porMiembro] = await Promise.all([
      ministeriosService.miembrosDe(ministerio.id),
      asistenciaPorIntegrante(ministerio.id, inicio, fin),
    ]);
    const datos = participacion.find((p) => p.ministerioId === ministerio.id);
    const filas = integrantes.map((m) => {
      const a = porMiembro.get(m.id) ?? { presentes: 0, ausentes: 0 };
      return {
        integrante: `${m.apellidos}, ${m.nombre}`,
        presentes: a.presentes,
        ausentes: a.ausentes,
        porcentaje: porcentaje(a.presentes, a.presentes + a.ausentes),
      };
    });
    return {
      ...base('ministerios', `Participación: ${ministerio.nombre}`, generador),
      subtitulo: `Coordinan: ${coordinadores.get(ministerio.id) || 'sin coordinador asignado'}`,
      filtros,
      resumen: [
        { etiqueta: 'Integrantes activos', valor: integrantes.length, tipo: 'numero' },
        { etiqueta: 'Eventos con asistencia', valor: datos?.eventos ?? 0, tipo: 'numero' },
        { etiqueta: 'Asistencia promedio', valor: datos?.porcentaje ?? null, tipo: 'porcentaje' },
      ],
      secciones: [
        {
          titulo: 'Integrantes',
          columnas: [
            { clave: 'integrante', titulo: 'Integrante', ancho: 2.5 },
            { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
            { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
            { clave: 'porcentaje', titulo: '% asistencia', tipo: 'porcentaje' },
          ],
          filas,
        },
      ],
    };
  }

  const filas = participacion
    .filter((p) => !permitidos || permitidos.includes(p.ministerioId))
    .map((p) => ({
      ministerio: p.ministerio,
      coordinadores: coordinadores.get(p.ministerioId) || null,
      integrantes: p.integrantes,
      eventos: p.eventos,
      presentes: p.presentes,
      ausentes: p.ausentes,
      porcentaje: p.porcentaje,
    }));
  const suma = (clave: 'integrantes' | 'eventos' | 'presentes' | 'ausentes') =>
    filas.reduce((s, f) => s + f[clave], 0);
  return {
    ...base('ministerios', 'Participación por ministerio', generador),
    filtros: [
      ...filtros,
      ...(permitidos ? [{ etiqueta: 'Alcance', valor: 'Ministerios que coordinas' }] : []),
    ],
    resumen: [
      { etiqueta: 'Ministerios', valor: filas.length, tipo: 'numero' },
      { etiqueta: 'Integrantes', valor: suma('integrantes'), tipo: 'numero' },
      {
        etiqueta: 'Asistencia promedio',
        valor: porcentaje(suma('presentes'), suma('presentes') + suma('ausentes')),
        tipo: 'porcentaje',
      },
    ],
    secciones: [
      {
        titulo: 'Ministerios',
        columnas: [
          { clave: 'ministerio', titulo: 'Ministerio', ancho: 1.6 },
          { clave: 'coordinadores', titulo: 'Coordinadores', ancho: 2 },
          { clave: 'integrantes', titulo: 'Integrantes', tipo: 'numero' },
          { clave: 'eventos', titulo: 'Eventos', tipo: 'numero' },
          { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
          { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
          { clave: 'porcentaje', titulo: '% asistencia', tipo: 'porcentaje' },
        ],
        filas,
        totales: {
          ministerio: 'Total',
          integrantes: suma('integrantes'),
          eventos: suma('eventos'),
          presentes: suma('presentes'),
          ausentes: suma('ausentes'),
        },
      },
    ],
  };
}

// ───────── RF-09.4 · Ingresos por periodo (B4-10) ─────────

export async function ingresos(
  query: QueryReporteIngresos,
  generador: Generador,
): Promise<Reporte> {
  const { desde, hasta } = await rangoPorDefecto(query, 0);
  const [resumen, detalle] = await Promise.all([
    donacionesService.resumenEntre(desde, hasta, query.agrupar),
    donacionesService.detalleParaReporte(desde, hasta),
  ]);
  const anonimas = detalle.filter((d) => d.anonima).length;
  const filasDetalle: Record<string, Celda>[] = detalle.map((d) => ({
    fecha: d.fecha,
    donante: d.miembro ? `${d.miembro.apellidos}, ${d.miembro.nombre}` : 'Anónimo',
    concepto: d.conceptoDetalle
      ? `${ETIQUETAS_CONCEPTO[d.concepto]} — ${d.conceptoDetalle}`
      : (ETIQUETAS_CONCEPTO[d.concepto] ?? d.concepto),
    metodo: ETIQUETAS_METODO[d.metodo] ?? d.metodo,
    referencia: d.referencia,
    monto: d.monto,
  }));
  return {
    ...base('ingresos', 'Reporte de ingresos', generador),
    filtros: [
      ...rangoTexto(desde, hasta),
      { etiqueta: 'Agrupado por', valor: ETIQUETAS_AGRUPAR[query.agrupar] },
    ],
    resumen: [
      { etiqueta: 'Total', valor: resumen.total, tipo: 'moneda' },
      { etiqueta: 'Aportaciones', valor: resumen.cantidad, tipo: 'numero' },
      { etiqueta: 'Anónimas', valor: anonimas, tipo: 'numero' },
      { etiqueta: 'Identificadas', valor: resumen.cantidad - anonimas, tipo: 'numero' },
    ],
    secciones: [
      {
        titulo: `Resumen por ${ETIQUETAS_AGRUPAR[query.agrupar].toLowerCase()}`,
        columnas: [
          { clave: 'grupo', titulo: ETIQUETAS_AGRUPAR[query.agrupar], ancho: 1.6 },
          { clave: 'cantidad', titulo: 'Aportaciones', tipo: 'numero' },
          { clave: 'total', titulo: 'Total', tipo: 'moneda' },
        ],
        filas: resumen.grupos.map((g) => ({
          grupo: etiquetaPeriodo(g.clave),
          cantidad: g.cantidad,
          total: g.total,
        })),
        totales: { grupo: 'Total', cantidad: resumen.cantidad, total: resumen.total },
      },
      {
        titulo: 'Detalle de aportaciones',
        columnas: [
          { clave: 'fecha', titulo: 'Fecha', tipo: 'fecha', ancho: 0.9 },
          { clave: 'donante', titulo: 'Donante', ancho: 2 },
          { clave: 'concepto', titulo: 'Concepto', ancho: 1.6 },
          { clave: 'metodo', titulo: 'Método' },
          { clave: 'referencia', titulo: 'Referencia' },
          { clave: 'monto', titulo: 'Monto', tipo: 'moneda' },
        ],
        filas: filasDetalle,
        totales: { donante: 'Total', monto: resumen.total },
      },
    ],
  };
}
