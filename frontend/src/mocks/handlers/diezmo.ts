import { http, HttpResponse } from 'msw';
import type { DetalleError } from '@/app/tipos/comunes';
import type { MisaCelebrada } from '@/app/tipos/diezmo';
import type { Usuario } from '@/app/tipos/usuarios';
import type { MisaMock } from '../datos/diezmo';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

// Simulación de backend/src/modules/{misas,diezmo}. El dinero se suma en centavos enteros.

const DIA = 24 * 60 * 60 * 1000;
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;
const aCentavos = (monto: string) => Math.round(Number(monto) * 100);
const deCentavos = (c: number) => (c / 100).toFixed(2);

// ───────── Hora local de la iglesia (RN-31) ─────────
const zonaDe = () => db.configuracion.zonaHoraria;

function partes(instante: Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  return { fecha: `${p['year']}-${p['month']}-${p['day']}`, hora: `${p['hour']}:${p['minute']}` };
}

/** Lunes de la semana de una fecha «yyyy-MM-dd» */
function lunesDe(fecha: string) {
  const d = new Date(`${fecha}T00:00:00Z`);
  const atras = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - atras * DIA).toISOString().slice(0, 10);
}

function periodoDe(url: URL): { desde: string; hasta: string } | Response {
  const hoy = partes(new Date(), zonaDe()).fecha;
  const desde = url.searchParams.get('desde') ?? `${hoy.slice(0, 8)}01`;
  const hasta = url.searchParams.get('hasta') ?? hoy;
  const valida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (!valida(desde) || !valida(hasta) || desde > hasta) {
    return errorApi(400, 'VALIDATION_ERROR', 'El periodo no es válido.', [
      { campo: 'desde', mensaje: 'La fecha inicial debe ser anterior a la final.' },
    ]);
  }
  return { desde, hasta };
}

// ───────── Alcance por iglesia (RNF-09, RNF-10) ─────────
/** Usuario con el permiso y de la iglesia de la ruta, o la respuesta 401/403 lista para devolver. */
function conAlcance(
  request: Request,
  iglesiaId: string,
  permiso: Parameters<typeof autenticar>[1],
) {
  const usuario = autenticar(request, permiso);
  if (usuario instanceof Response) return usuario;
  if (usuario.iglesiaId !== iglesiaId) {
    return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
  return usuario;
}

const nombreUsuario = (id: string) => ({
  id,
  nombre: db.usuarios.find((u: Usuario) => u.id === id)?.nombre ?? '—',
});

function aMisa(m: MisaMock): MisaCelebrada {
  const local = partes(new Date(m.inicio), zonaDe());
  const d = db.diezmos.find((x) => x.misaId === m.id);
  const padre = db.padres.find((p) => p.id === m.padreId) ?? { id: m.padreId, nombre: '—' };
  return {
    id: m.id,
    inicio: m.inicio,
    fechaLocal: local.fecha,
    horaLocal: local.hora,
    padre,
    diezmo: d ? { monto: d.monto, actualizadoEn: d.updatedAt } : null,
  };
}

/** Misas de la iglesia cuyo día local cae en el periodo, de la más reciente a la más antigua */
function misasDelPeriodo(iglesiaId: string, p: { desde: string; hasta: string }) {
  return db.misas
    .filter((m) => m.iglesiaId === iglesiaId)
    .map((m) => ({ m, local: partes(new Date(m.inicio), zonaDe()) }))
    .filter(({ local }) => local.fecha >= p.desde && local.fecha <= p.hasta)
    .sort((a, b) => b.m.inicio.localeCompare(a.m.inicio));
}

function misaDe(iglesiaId: string, misaId: string) {
  return db.misas.find((m) => m.id === misaId && m.iglesiaId === iglesiaId);
}

function validarMonto(cuerpo: { monto?: unknown }): Response | null {
  const monto = typeof cuerpo.monto === 'string' ? cuerpo.monto.trim() : '';
  if (!FORMATO_MONTO.test(monto)) {
    const detalle: DetalleError = {
      campo: 'monto',
      mensaje: 'Monto no válido (sin signo, hasta 2 decimales).',
    };
    return errorApi(400, 'VALIDATION_ERROR', 'El monto no es válido.', [detalle]);
  }
  return null;
}

const noExisteMisa = () => errorApi(404, 'NOT_FOUND', 'La misa no existe en esta iglesia.');
const sinDiezmo = () => errorApi(404, 'NOT_FOUND', 'Esta misa todavía no tiene diezmo capturado.');

export const diezmoHandlers = [
  // ───────── Padres ─────────
  http.get(ruta('/iglesias/:iglesiaId/padres'), ({ request, params }) => {
    const usuario = conAlcance(request, String(params['iglesiaId']), 'misas:leer');
    if (usuario instanceof Response) return usuario;
    const lista = [...db.padres].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return HttpResponse.json({ data: lista });
  }),

  http.post(ruta('/iglesias/:iglesiaId/padres'), async ({ request, params }) => {
    const usuario = conAlcance(request, String(params['iglesiaId']), 'misas:registrar');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as { nombre?: string };
    const nombre = cuerpo.nombre?.trim() ?? '';
    if (!nombre) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'nombre', mensaje: 'Escribe el nombre del padre.' },
      ]);
    }
    const padre = { id: crypto.randomUUID(), nombre };
    db.padres.push(padre);
    return HttpResponse.json({ data: padre }, { status: 201 });
  }),

  // ───────── Misas celebradas ─────────
  http.get(ruta('/iglesias/:iglesiaId/misas-celebradas'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const usuario = conAlcance(request, iglesiaId, 'misas:leer');
    if (usuario instanceof Response) return usuario;
    const url = new URL(request.url);
    const periodo = periodoDe(url);
    if (periodo instanceof Response) return periodo;
    return paginarMock(
      misasDelPeriodo(iglesiaId, periodo).map(({ m }) => aMisa(m)),
      url,
    );
  }),

  http.post(ruta('/iglesias/:iglesiaId/misas-celebradas'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const usuario = conAlcance(request, iglesiaId, 'misas:registrar');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as { inicio?: string; padreId?: string };
    const inicio = new Date(cuerpo.inicio ?? '');
    if (Number.isNaN(inicio.getTime()) || !cuerpo.padreId) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
    }
    if (inicio.getTime() > Date.now()) {
      return errorApi(422, 'BUSINESS_RULE', 'Solo se registra una misa que ya se celebró.');
    }
    if (!db.padres.some((p) => p.id === cuerpo.padreId)) {
      return errorApi(404, 'NOT_FOUND', 'El padre no existe.');
    }
    const iso = inicio.toISOString();
    if (db.misas.some((m) => m.iglesiaId === iglesiaId && m.inicio === iso)) {
      return errorApi(409, 'CONFLICT', 'Ya hay una misa registrada a esa hora.');
    }
    const misa: MisaMock = {
      id: crypto.randomUUID(),
      iglesiaId,
      inicio: iso,
      padreId: cuerpo.padreId,
    };
    db.misas.push(misa);
    return HttpResponse.json({ data: aMisa(misa) }, { status: 201 });
  }),

  // ───────── Captura, consulta y corrección ─────────
  http.post(
    ruta('/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo'),
    async ({ request, params }) => {
      const iglesiaId = String(params['iglesiaId']);
      const usuario = conAlcance(request, iglesiaId, 'diezmo:capturar');
      if (usuario instanceof Response) return usuario;
      const misa = misaDe(iglesiaId, String(params['misaId']));
      if (!misa) return noExisteMisa();
      const cuerpo = (await request.json()) as { monto?: string };
      const invalido = validarMonto(cuerpo);
      if (invalido) return invalido;
      if (db.diezmos.some((d) => d.misaId === misa.id)) {
        return errorApi(409, 'CONFLICT', 'Esta misa ya tiene diezmo capturado; corrígelo.');
      }
      const diezmo = {
        id: crypto.randomUUID(),
        misaId: misa.id,
        iglesiaId,
        monto: Number(cuerpo.monto?.trim()).toFixed(2),
        capturadoPorId: usuario.id,
        createdAt: ahora(),
        updatedAt: ahora(),
      };
      db.diezmos.push(diezmo);
      return HttpResponse.json({ data: aDiezmo(diezmo) }, { status: 201 });
    },
  ),

  http.get(ruta('/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const usuario = conAlcance(request, iglesiaId, 'diezmo:leer');
    if (usuario instanceof Response) return usuario;
    const misa = misaDe(iglesiaId, String(params['misaId']));
    if (!misa) return noExisteMisa();
    const diezmo = db.diezmos.find((d) => d.misaId === misa.id);
    return diezmo ? HttpResponse.json({ data: aDiezmo(diezmo) }) : sinDiezmo();
  }),

  http.patch(
    ruta('/iglesias/:iglesiaId/misas-celebradas/:misaId/diezmo'),
    async ({ request, params }) => {
      const iglesiaId = String(params['iglesiaId']);
      const usuario = conAlcance(request, iglesiaId, 'diezmo:capturar');
      if (usuario instanceof Response) return usuario;
      const misa = misaDe(iglesiaId, String(params['misaId']));
      if (!misa) return noExisteMisa();
      const diezmo = db.diezmos.find((d) => d.misaId === misa.id);
      if (!diezmo) return sinDiezmo();
      const cuerpo = (await request.json()) as { monto?: string };
      const invalido = validarMonto(cuerpo);
      if (invalido) return invalido;
      const nuevo = Number(cuerpo.monto?.trim()).toFixed(2);
      if (aCentavos(nuevo) === aCentavos(diezmo.monto)) {
        return errorApi(422, 'BUSINESS_RULE', 'El monto es el mismo que ya está capturado.');
      }
      db.correcciones.push({
        id: crypto.randomUUID(),
        diezmoId: diezmo.id,
        montoAnterior: diezmo.monto,
        montoNuevo: nuevo,
        hechaPorId: usuario.id,
        hechaEn: ahora(),
      });
      diezmo.monto = nuevo;
      diezmo.updatedAt = ahora();
      return HttpResponse.json({ data: aDiezmo(diezmo) });
    },
  ),

  // ───────── Reportes ─────────
  http.get(ruta('/iglesias/:iglesiaId/diezmo/resumen'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const usuario = conAlcance(request, iglesiaId, 'diezmo:leer');
    if (usuario instanceof Response) return usuario;
    const periodo = periodoDe(new URL(request.url));
    if (periodo instanceof Response) return periodo;

    const filas = conDiezmo(iglesiaId, periodo);
    const total = filas.reduce((s, f) => s + aCentavos(f.diezmo.monto), 0);
    const extremo = (f: (typeof filas)[number]) => ({
      misaId: f.m.id,
      inicio: f.m.inicio,
      fechaLocal: f.local.fecha,
      horaLocal: f.local.hora,
      monto: f.diezmo.monto,
    });
    const orden = [...filas].sort((a, b) => aCentavos(b.diezmo.monto) - aCentavos(a.diezmo.monto));
    return HttpResponse.json({
      data: {
        ...periodo,
        misas: filas.length,
        total: deCentavos(total),
        promedio: filas.length ? deCentavos(Math.round(total / filas.length)) : null,
        conMas: orden.slice(0, 1).map(extremo),
        conMenos: orden.slice(-1).map(extremo),
      },
    });
  }),

  http.get(ruta('/iglesias/:iglesiaId/diezmo/agrupado'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const usuario = conAlcance(request, iglesiaId, 'diezmo:leer');
    if (usuario instanceof Response) return usuario;
    const url = new URL(request.url);
    const periodo = periodoDe(url);
    if (periodo instanceof Response) return periodo;
    const por = url.searchParams.get('por') ?? '';
    if (!['dia', 'semana', 'mes', 'horario', 'padre'].includes(por)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'por', mensaje: 'Elige: dia, semana, mes, horario o padre.' },
      ]);
    }
    const clave = (f: ReturnType<typeof conDiezmo>[number]) => {
      if (por === 'dia') return f.local.fecha;
      if (por === 'semana') return lunesDe(f.local.fecha);
      if (por === 'mes') return f.local.fecha.slice(0, 7);
      if (por === 'horario') return f.local.hora;
      return db.padres.find((p) => p.id === f.m.padreId)?.nombre ?? '—';
    };
    const grupos = new Map<string, { misas: number; centavos: number }>();
    for (const f of conDiezmo(iglesiaId, periodo)) {
      const k = clave(f);
      const g = grupos.get(k) ?? { misas: 0, centavos: 0 };
      g.misas += 1;
      g.centavos += aCentavos(f.diezmo.monto);
      grupos.set(k, g);
    }
    const lista = [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, g]) => ({
        clave: k,
        etiqueta: por === 'semana' ? `Semana del ${k}` : k,
        misas: g.misas,
        total: deCentavos(g.centavos),
      }));
    return HttpResponse.json({ data: { ...periodo, por, grupos: lista } });
  }),
];

function conDiezmo(iglesiaId: string, periodo: { desde: string; hasta: string }) {
  return misasDelPeriodo(iglesiaId, periodo).flatMap(({ m, local }) => {
    const diezmo = db.diezmos.find((d) => d.misaId === m.id);
    return diezmo ? [{ m, local, diezmo }] : [];
  });
}

function aDiezmo(d: (typeof db.diezmos)[number]) {
  return {
    id: d.id,
    misaId: d.misaId,
    monto: d.monto,
    capturadoPor: nombreUsuario(d.capturadoPorId),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    correcciones: db.correcciones
      .filter((c) => c.diezmoId === d.id)
      .sort((a, b) => b.hechaEn.localeCompare(a.hechaEn))
      .map((c) => ({
        id: c.id,
        montoAnterior: c.montoAnterior,
        montoNuevo: c.montoNuevo,
        hechaPor: nombreUsuario(c.hechaPorId),
        hechaEn: c.hechaEn,
      })),
  };
}
