import { format } from 'date-fns';
import { http, HttpResponse } from 'msw';
import { tienePermiso } from '@/app/core/permisos';
import type { Usuario } from '@/app/tipos/usuarios';
import type {
  Celda,
  DatoReporte,
  Reporte,
  SeccionReporte,
  TipoReporte,
} from '@/app/tipos/reportes';
import { db } from '../db';
import { autenticar, errorApi, ruta } from '../utils';
import { deCentavos, resumenEntre } from './donaciones';
import { marcarRealizados } from './eventos';

// Simulación de backend/src/modules/reportes (B4-09 … B4-13). Mismo formato `Reporte` para los
// cuatro tipos; PDF y Excel devuelven un archivo de relleno con el nombre de Content-Disposition.

const ETIQUETAS_ESTADO = { activo: 'Activos', inactivo: 'Inactivos', todos: 'Todos' } as const;
const ETIQUETAS_AGRUPAR = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  concepto: 'Concepto',
  metodo: 'Método',
} as const;

const nombreMiembro = (id: string) => {
  const m = db.miembros.find((x) => x.id === id);
  return m ? `${m.nombre} ${m.apellidos}` : '—';
};

const porcentaje = (presentes: number, total: number) =>
  total === 0 ? null : Math.round((presentes / total) * 1000) / 10;

function envolver(
  tipo: TipoReporte,
  usuario: Usuario,
  datos: Pick<Reporte, 'titulo' | 'filtros' | 'resumen' | 'secciones'> & { subtitulo?: string },
): Reporte {
  return { tipo, ...datos, generadoEn: new Date().toISOString(), generadoPor: usuario.nombre };
}

function filtroRango(desde: string | null, hasta: string | null): DatoReporte[] {
  return [
    ...(desde ? [{ etiqueta: 'Desde', valor: desde, tipo: 'fecha' as const }] : []),
    ...(hasta ? [{ etiqueta: 'Hasta', valor: hasta, tipo: 'fecha' as const }] : []),
  ];
}

/** Ministerios que puede ver el usuario: todos, o los que coordina (COORDINADOR). */
function ministeriosVisibles(usuario: Usuario) {
  const todos = db.ministerios.filter((m) => m.activo);
  if (tienePermiso(usuario.rol, 'reportes:generales')) return todos;
  const propios = db.coordinaciones.filter((c) => c.usuarioId === usuario.id);
  return todos.filter((m) => propios.some((c) => c.ministerioId === m.id));
}

function reporteMiembros(usuario: Usuario, p: URLSearchParams) {
  const estado = (p.get('estado') ?? 'activo') as keyof typeof ETIQUETAS_ESTADO;
  const filas = db.miembros
    .filter((m) => estado === 'todos' || m.activo === (estado === 'activo'))
    .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre))
    .map((m) => ({
      nombre: `${m.apellidos}, ${m.nombre}`,
      telefono: m.telefono,
      email: m.email,
      fechaIngreso: m.fechaIngreso,
      estado: m.activo ? 'Activo' : 'Inactivo',
      ministerios:
        db.vinculos
          .filter((v) => v.miembroId === m.id && v.activo)
          .map((v) => db.ministerios.find((x) => x.id === v.ministerioId)?.nombre)
          .filter(Boolean)
          .join(', ') || null,
    }));
  const activos = filas.filter((f) => f.estado === 'Activo').length;
  return envolver('miembros', usuario, {
    titulo: 'Reporte general de miembros',
    filtros: [{ etiqueta: 'Estado', valor: ETIQUETAS_ESTADO[estado] }],
    resumen: [
      { etiqueta: 'Miembros', valor: filas.length, tipo: 'numero' },
      { etiqueta: 'Activos', valor: activos, tipo: 'numero' },
      { etiqueta: 'Inactivos', valor: filas.length - activos, tipo: 'numero' },
    ],
    secciones: [
      {
        titulo: 'Miembros',
        columnas: [
          { clave: 'nombre', titulo: 'Nombre' },
          { clave: 'telefono', titulo: 'Teléfono' },
          { clave: 'email', titulo: 'Correo' },
          { clave: 'fechaIngreso', titulo: 'Ingreso', tipo: 'fecha' },
          { clave: 'estado', titulo: 'Estado' },
          { clave: 'ministerios', titulo: 'Ministerios' },
        ],
        filas,
      },
    ],
  });
}

function reporteAsistencia(usuario: Usuario, p: URLSearchParams): Reporte | Response {
  marcarRealizados();
  const eventoId = p.get('eventoId');
  if (eventoId) {
    const evento = db.eventos.find((e) => e.id === eventoId);
    if (!evento) return errorApi(404, 'NOT_FOUND', 'El evento no existe.');
    const registros = db.asistencias.filter((a) => a.eventoId === eventoId);
    const presentes = registros.filter((a) => a.presente).length;
    return envolver('asistencia', usuario, {
      titulo: 'Reporte de asistencia',
      subtitulo: `${evento.titulo} · ${evento.lugar}`,
      filtros: [{ etiqueta: 'Evento', valor: evento.titulo }],
      resumen: [
        { etiqueta: 'Presentes', valor: presentes, tipo: 'numero' },
        { etiqueta: 'Ausentes', valor: registros.length - presentes, tipo: 'numero' },
        {
          etiqueta: 'Asistencia',
          valor: porcentaje(presentes, registros.length),
          tipo: 'porcentaje',
        },
      ],
      secciones: [
        {
          titulo: 'Pase de lista',
          columnas: [
            { clave: 'miembro', titulo: 'Miembro' },
            { clave: 'asistencia', titulo: 'Asistencia' },
            { clave: 'registradoEn', titulo: 'Registrado', tipo: 'fechaHora' },
          ],
          filas: registros.map((a) => ({
            miembro: nombreMiembro(a.miembroId),
            asistencia: a.presente ? 'Presente' : 'Ausente',
            registradoEn: a.registradoEn,
          })),
        },
      ],
    });
  }

  const periodo = p.get('periodo') === 'mensual' ? 'mensual' : 'semanal';
  const desde = p.get('desde');
  const hasta = p.get('hasta');
  // Como el backend: con `ministerioId` solo cuentan los eventos de ese ministerio (PR #2)
  const ministerioId = p.get('ministerioId');
  const ministerio = ministerioId ? db.ministerios.find((m) => m.id === ministerioId) : undefined;
  const eventos = db.eventos
    .filter((e) => e.estado !== 'CANCELADO')
    .filter((e) => !ministerioId || e.ministerioId === ministerioId)
    .filter((e) => !desde || e.fechaInicio.slice(0, 10) >= desde)
    .filter((e) => !hasta || e.fechaInicio.slice(0, 10) <= hasta)
    .map((e) => {
      const registros = db.asistencias.filter((a) => a.eventoId === e.id);
      const presentes = registros.filter((a) => a.presente).length;
      return { e, presentes, ausentes: registros.length - presentes, total: registros.length };
    })
    .filter((x) => x.total > 0);
  const presentes = eventos.reduce((s, x) => s + x.presentes, 0);
  const ausentes = eventos.reduce((s, x) => s + x.ausentes, 0);
  const porClave = new Map<string, { eventos: number; presentes: number; ausentes: number }>();
  for (const x of eventos) {
    const clave = x.e.fechaInicio.slice(0, periodo === 'mensual' ? 7 : 10);
    const fila = porClave.get(clave) ?? { eventos: 0, presentes: 0, ausentes: 0 };
    fila.eventos += 1;
    fila.presentes += x.presentes;
    fila.ausentes += x.ausentes;
    porClave.set(clave, fila);
  }
  return envolver('asistencia', usuario, {
    titulo: 'Reporte de asistencia',
    filtros: [
      { etiqueta: 'Periodo', valor: periodo === 'semanal' ? 'Semanal' : 'Mensual' },
      ...(ministerio ? [{ etiqueta: 'Ministerio', valor: ministerio.nombre }] : []),
      ...filtroRango(desde, hasta),
    ],
    resumen: [
      { etiqueta: 'Eventos con asistencia', valor: eventos.length, tipo: 'numero' },
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
        titulo: periodo === 'semanal' ? 'Resumen semanal' : 'Resumen mensual',
        columnas: [
          { clave: 'periodo', titulo: 'Periodo' },
          { clave: 'eventos', titulo: 'Eventos', tipo: 'numero' },
          { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
          { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
        ],
        filas: [...porClave].map(([periodoClave, f]) => ({ periodo: periodoClave, ...f })),
      },
      {
        titulo: 'Eventos',
        columnas: [
          { clave: 'fecha', titulo: 'Fecha', tipo: 'fechaHora' },
          { clave: 'evento', titulo: 'Evento' },
          { clave: 'presentes', titulo: 'Presentes', tipo: 'numero' },
          { clave: 'ausentes', titulo: 'Ausentes', tipo: 'numero' },
          { clave: 'porcentaje', titulo: '% asistencia', tipo: 'porcentaje' },
        ],
        filas: eventos.map((x) => ({
          fecha: x.e.fechaInicio,
          evento: x.e.titulo,
          presentes: x.presentes,
          ausentes: x.ausentes,
          porcentaje: porcentaje(x.presentes, x.total),
        })),
      },
    ],
  });
}

function reporteMinisterios(usuario: Usuario, p: URLSearchParams): Reporte {
  const ministerioId = p.get('ministerioId');
  const filas = ministeriosVisibles(usuario)
    .filter((m) => !ministerioId || m.id === ministerioId)
    .map((m) => {
      const integrantes = db.vinculos.filter((v) => v.ministerioId === m.id && v.activo).length;
      const coordinadores = db.coordinaciones
        .filter((c) => c.ministerioId === m.id)
        .map((c) => db.usuarios.find((u) => u.id === c.usuarioId)?.nombre)
        .filter(Boolean)
        .join(', ');
      return { ministerio: m.nombre, coordinadores: coordinadores || null, integrantes };
    });
  return envolver('ministerios', usuario, {
    titulo: 'Reporte de participación por ministerio',
    filtros: filtroRango(p.get('desde'), p.get('hasta')),
    resumen: [
      { etiqueta: 'Ministerios', valor: filas.length, tipo: 'numero' },
      {
        etiqueta: 'Integrantes',
        valor: filas.reduce((s, f) => s + f.integrantes, 0),
        tipo: 'numero',
      },
    ],
    secciones: [
      {
        titulo: 'Ministerios',
        columnas: [
          { clave: 'ministerio', titulo: 'Ministerio' },
          { clave: 'coordinadores', titulo: 'Coordinadores' },
          { clave: 'integrantes', titulo: 'Integrantes', tipo: 'numero' },
        ],
        filas,
      },
    ],
  });
}

function reporteIngresos(usuario: Usuario, p: URLSearchParams): Reporte {
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const hasta = p.get('hasta') ?? hoy;
  const desde = p.get('desde') ?? `${hasta.slice(0, 4)}-01-01`;
  const agrupar = (p.get('agrupar') ?? 'mes') as keyof typeof ETIQUETAS_AGRUPAR;
  const resumen = resumenEntre(desde, hasta, agrupar);
  const detalle = db.donaciones
    .filter((d) => !d.anulada && d.fecha >= desde && d.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const anonimas = detalle.filter((d) => d.anonima).length;
  const grupos: SeccionReporte = {
    titulo: `Resumen por ${ETIQUETAS_AGRUPAR[agrupar].toLowerCase()}`,
    columnas: [
      { clave: 'grupo', titulo: ETIQUETAS_AGRUPAR[agrupar] },
      { clave: 'cantidad', titulo: 'Aportaciones', tipo: 'numero' },
      { clave: 'total', titulo: 'Total', tipo: 'moneda' },
    ],
    filas: resumen.grupos.map((g) => ({ grupo: g.clave, cantidad: g.cantidad, total: g.total })),
    totales: { grupo: 'Total', cantidad: resumen.cantidad, total: resumen.total },
  };
  const filasDetalle: Record<string, Celda>[] = detalle.map((d) => ({
    fecha: d.fecha,
    donante: d.miembroId ? nombreMiembro(d.miembroId) : 'Anónimo',
    concepto: d.concepto,
    metodo: d.metodo,
    referencia: d.referencia,
    monto: d.monto,
  }));
  return envolver('ingresos', usuario, {
    titulo: 'Reporte de ingresos',
    filtros: [
      ...filtroRango(desde, hasta),
      { etiqueta: 'Agrupado por', valor: ETIQUETAS_AGRUPAR[agrupar] },
    ],
    resumen: [
      { etiqueta: 'Total', valor: resumen.total, tipo: 'moneda' },
      { etiqueta: 'Aportaciones', valor: resumen.cantidad, tipo: 'numero' },
      { etiqueta: 'Anónimas', valor: anonimas, tipo: 'numero' },
      { etiqueta: 'Identificadas', valor: resumen.cantidad - anonimas, tipo: 'numero' },
    ],
    secciones: [
      grupos,
      {
        titulo: 'Detalle de aportaciones',
        columnas: [
          { clave: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
          { clave: 'donante', titulo: 'Donante' },
          { clave: 'concepto', titulo: 'Concepto' },
          { clave: 'metodo', titulo: 'Método' },
          { clave: 'referencia', titulo: 'Referencia' },
          { clave: 'monto', titulo: 'Monto', tipo: 'moneda' },
        ],
        filas: filasDetalle,
        totales: {
          fecha: 'Total',
          monto: deCentavos(detalle.reduce((s, d) => s + Math.round(Number(d.monto) * 100), 0)),
        },
      },
    ],
  });
}

const TIPOS_MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

function responder(reporte: Reporte | Response, formato: string | null) {
  if (reporte instanceof Response) return reporte;
  if (formato === 'pdf' || formato === 'xlsx') {
    const nombre = `reporte-${reporte.tipo}-${format(new Date(), 'yyyy-MM-dd')}.${formato}`;
    // Bytes y no un Blob: el Blob de jsdom no implementa stream() y Response (undici, Node 22) lo exige
    return new HttpResponse(new TextEncoder().encode(`Archivo simulado: ${reporte.titulo}`), {
      headers: {
        'Content-Type': TIPOS_MIME[formato],
        'Content-Disposition': `attachment; filename="${nombre}"`,
      },
    });
  }
  return HttpResponse.json({ data: reporte });
}

/** 400 si "hasta" es anterior a "desde" (como los esquemas Zod del backend). */
function validarRango(p: URLSearchParams): Response | null {
  const desde = p.get('desde');
  const hasta = p.get('hasta');
  if (desde && hasta && hasta < desde) {
    return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
      { campo: 'hasta', mensaje: '"hasta" debe ser igual o posterior a "desde".' },
    ]);
  }
  return null;
}

type Constructor = (usuario: Usuario, p: URLSearchParams) => Reporte | Response;

function handlerReporte(tipo: TipoReporte, construir: Constructor) {
  return http.get(ruta(`/reportes/${tipo}`), ({ request }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    const permitido =
      tipo === 'ingresos'
        ? tienePermiso(usuario.rol, 'reportes:ingresos')
        : tienePermiso(usuario.rol, 'reportes:generales') ||
          tienePermiso(usuario.rol, 'reportes:generales-propio');
    if (!permitido) {
      return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
    }
    const p = new URL(request.url).searchParams;
    const invalido = validarRango(p);
    if (invalido) return invalido;
    return responder(construir(usuario, p), p.get('formato'));
  });
}

export const reportesHandlers = [
  handlerReporte('miembros', reporteMiembros),
  handlerReporte('asistencia', reporteAsistencia),
  handlerReporte('ministerios', reporteMinisterios),
  handlerReporte('ingresos', reporteIngresos),
];
