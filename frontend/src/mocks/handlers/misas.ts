import { http, HttpResponse } from 'msw';
import { tienePermiso } from '@/app/core/permisos';
import type { Permiso } from '@/app/tipos/comunes';
import type { HorarioMisaEntrada } from '@/app/tipos/misas';
import type { PlaticaEntrada, ServicioEntrada } from '@/app/tipos/servicios';
import type { Usuario } from '@/app/tipos/usuarios';
import type { HorarioMisaMock } from '../datos/misas';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

// Simulación de backend/src/modules/{misas,servicios} (E3-06 a E3-14, Genaro). Las horas son locales;
// el mock compara choques con la hora local (sin zonas): el backend real usa el momento real.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA = 86_400_000;

/** Usuario con alguno de los permisos; si la ruta es de una iglesia, que sea la suya (o la Coordinación si se permite). */
function acceso(
  request: Request,
  permisos: Permiso[],
  iglesiaId?: string,
  coordinacion = false,
): Usuario | Response {
  const usuario = autenticar(request);
  if (usuario instanceof Response) return usuario;
  if (!permisos.some((p) => tienePermiso(usuario.rol, p))) {
    return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
  if (
    iglesiaId &&
    usuario.iglesiaId !== iglesiaId &&
    !(coordinacion && usuario.iglesiaId === null)
  ) {
    return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
  return usuario;
}

const padreDe = (id: string) => {
  const p = db.padres.find((x) => x.id === id);
  return { id, nombre: p?.nombre ?? '—', titulo: p?.titulo ?? null };
};

const asociados = (iglesiaId: string) =>
  db.padresIglesia
    .filter((a) => a.iglesiaId === iglesiaId && a.activo)
    .map((a) => padreDe(a.padreId))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

const minutos = (hora: string) => {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
};

/** RN-26 (simplificado): mismo padre, mismo día y horas locales que se empalman. */
function choque(nueva: HorarioMisaEntrada & { id?: string }) {
  const ini = minutos(nueva.hora);
  const fin = ini + (nueva.duracionMin ?? 60);
  return db.horariosMisa.find((m) => {
    if (!m.activo || m.padreId !== nueva.padreId || m.id === nueva.id) return false;
    if (m.diaSemana !== nueva.diaSemana) return false;
    const i = minutos(m.hora);
    return ini < i + (m.duracionMin ?? 60) && i < fin;
  });
}

const aHorario = (m: HorarioMisaMock) => ({
  id: m.id,
  diaSemana: m.diaSemana,
  hora: m.hora,
  tipo: m.tipo,
  idioma: m.idioma,
  duracionMin: m.duracionMin,
  activo: m.activo,
  padre: padreDe(m.padreId),
});

function guardarHorario(iglesiaId: string, datos: HorarioMisaEntrada, id?: string) {
  if (
    !db.padresIglesia.some(
      (a) => a.padreId === datos.padreId && a.iglesiaId === iglesiaId && a.activo,
    )
  ) {
    return errorApi(
      422,
      'BUSINESS_RULE',
      'El padre no está asociado a esta iglesia. Asócialo antes de asignarle misas.',
    );
  }
  const otra = choque({ ...datos, id });
  if (otra) {
    const iglesia = db.iglesias.find((i) => i.id === otra.iglesiaId)?.nombre ?? 'otra iglesia';
    return errorApi(
      409,
      'CONFLICT',
      `El padre ya tiene una misa el ${DIAS[otra.diaSemana]} a las ${otra.hora} en ${iglesia} que se empalma con esta.`,
    );
  }
  if (id) {
    const actual = db.horariosMisa.find((m) => m.id === id)!;
    Object.assign(actual, datos);
    return HttpResponse.json({ data: aHorario(actual) });
  }
  const nueva: HorarioMisaMock = {
    ...datos,
    id: `hm-${crypto.randomUUID()}`,
    iglesiaId,
    activo: true,
  };
  db.horariosMisa.push(nueva);
  return HttpResponse.json({ data: aHorario(nueva) }, { status: 201 });
}

export const misasHandlers = [
  // ───────── Padres de la iglesia ─────────
  http.get(ruta('/iglesias/:iglesiaId/padres'), ({ request, params }) => {
    const u = acceso(
      request,
      ['misas:leer', 'padres:gestionar'],
      String(params['iglesiaId']),
      true,
    );
    if (u instanceof Response) return u;
    return HttpResponse.json({ data: asociados(String(params['iglesiaId'])) });
  }),

  http.post(ruta('/iglesias/:iglesiaId/padres'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:programar', 'misas:registrar'], iglesiaId);
    if (u instanceof Response) return u;
    const datos = (await request.json()) as { nombre?: string; titulo?: string | null };
    const nombre = datos.nombre?.trim() ?? '';
    if (!nombre) {
      return errorApi(400, 'VALIDATION_ERROR', 'Datos inválidos.', [
        { campo: 'nombre', mensaje: 'Escribe el nombre.' },
      ]);
    }
    const existente = db.padres.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      return errorApi(
        409,
        'CONFLICT',
        'Ya hay un padre registrado con ese nombre. Asócialo a tu iglesia en lugar de crearlo de nuevo.',
        [{ campo: 'nombre', mensaje: `Padre existente: ${existente.id}` }],
      );
    }
    const padre = { id: `pa-${crypto.randomUUID()}`, nombre, titulo: datos.titulo ?? null };
    db.padres.push(padre);
    db.padresIglesia.push({ padreId: padre.id, iglesiaId, activo: true });
    return HttpResponse.json({ data: padre }, { status: 201 });
  }),

  http.put(ruta('/iglesias/:iglesiaId/padres/:padreId'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const padreId = String(params['padreId']);
    const u = acceso(request, ['misas:programar'], iglesiaId);
    if (u instanceof Response) return u;
    if (!db.padres.some((p) => p.id === padreId))
      return errorApi(404, 'NOT_FOUND', 'El padre no existe o está dado de baja.');
    const a = db.padresIglesia.find((x) => x.padreId === padreId && x.iglesiaId === iglesiaId);
    if (a) a.activo = true;
    else db.padresIglesia.push({ padreId, iglesiaId, activo: true });
    return HttpResponse.json({ data: padreDe(padreId) });
  }),

  http.delete(ruta('/iglesias/:iglesiaId/padres/:padreId'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const padreId = String(params['padreId']);
    const u = acceso(request, ['misas:programar'], iglesiaId);
    if (u instanceof Response) return u;
    const a = db.padresIglesia.find(
      (x) => x.padreId === padreId && x.iglesiaId === iglesiaId && x.activo,
    );
    if (!a) return errorApi(404, 'NOT_FOUND', 'El padre no está asociado a esta iglesia.');
    const enHorario = db.horariosMisa.filter(
      (m) => m.padreId === padreId && m.iglesiaId === iglesiaId && m.activo,
    ).length;
    if (enHorario > 0) {
      return errorApi(
        422,
        'BUSINESS_RULE',
        `El padre tiene ${enHorario} misa(s) en el horario de esta iglesia. Asígnalas a otro padre antes de quitarlo.`,
      );
    }
    a.activo = false;
    return new HttpResponse(null, { status: 204 });
  }),

  // ───────── Padres de todo el país ─────────
  http.get(ruta('/padres'), ({ request }) => {
    const u = acceso(request, ['padres:gestionar', 'misas:programar']);
    if (u instanceof Response) return u;
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const lista = db.padres
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => ({
        ...padreDe(p.id),
        activo: true,
        iglesias: db.padresIglesia
          .filter((a) => a.padreId === p.id && a.activo)
          .map((a) => ({
            id: a.iglesiaId,
            nombre: db.iglesias.find((i) => i.id === a.iglesiaId)?.nombre ?? '—',
          })),
      }));
    return paginarMock(lista, url);
  }),

  http.post(ruta('/padres'), async ({ request }) => {
    const u = acceso(request, ['padres:gestionar']);
    if (u instanceof Response) return u;
    const datos = (await request.json()) as { nombre: string; titulo: string | null };
    if (db.padres.some((p) => p.nombre.toLowerCase() === datos.nombre.toLowerCase())) {
      return errorApi(409, 'CONFLICT', 'Ya hay un padre registrado con ese nombre.');
    }
    const padre = { id: `pa-${crypto.randomUUID()}`, nombre: datos.nombre, titulo: datos.titulo };
    db.padres.push(padre);
    return HttpResponse.json({ data: { ...padre, activo: true, iglesias: [] } }, { status: 201 });
  }),

  http.get(ruta('/padres/:padreId/agenda'), ({ request, params }) => {
    const u = acceso(request, ['padres:gestionar', 'misas:leer']);
    if (u instanceof Response) return u;
    const padreId = String(params['padreId']);
    if (!db.padres.some((p) => p.id === padreId))
      return errorApi(404, 'NOT_FOUND', 'El padre no existe.');
    if (
      u.iglesiaId &&
      !db.padresIglesia.some(
        (a) => a.padreId === padreId && a.iglesiaId === u.iglesiaId && a.activo,
      )
    ) {
      return errorApi(
        403,
        'FORBIDDEN',
        'Solo ves la agenda de los padres que celebran en tu iglesia.',
      );
    }
    const semana = new URL(request.url).searchParams.get('semana') ?? ahora().slice(0, 10);
    const base = new Date(`${semana}T12:00:00Z`);
    const domingo = new Date(base.getTime() - base.getUTCDay() * DIA).toISOString().slice(0, 10);
    const misas = db.horariosMisa
      .filter((m) => m.padreId === padreId && m.activo)
      .map((m) => {
        const fecha = new Date(new Date(`${domingo}T12:00:00Z`).getTime() + m.diaSemana * DIA)
          .toISOString()
          .slice(0, 10);
        const inicio = new Date(`${fecha}T${m.hora}:00-06:00`);
        return {
          horarioId: m.id,
          iglesia: {
            id: m.iglesiaId,
            nombre: db.iglesias.find((i) => i.id === m.iglesiaId)?.nombre ?? '—',
          },
          diaSemana: m.diaSemana,
          fecha,
          hora: m.hora,
          zonaHoraria: 'America/Mexico_City',
          duracionMin: m.duracionMin,
          tipo: m.tipo,
          idioma: m.idioma,
          inicio: inicio.toISOString(),
          fin: new Date(inicio.getTime() + (m.duracionMin ?? 60) * 60_000).toISOString(),
        };
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    return HttpResponse.json({
      data: {
        padre: { ...padreDe(padreId), activo: true },
        semana: {
          desde: domingo,
          hasta: new Date(new Date(`${domingo}T12:00:00Z`).getTime() + 6 * DIA)
            .toISOString()
            .slice(0, 10),
        },
        misas,
      },
    });
  }),

  // ───────── Horario semanal ─────────
  http.get(ruta('/iglesias/:iglesiaId/horario-misas'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:leer', 'padres:gestionar'], iglesiaId, true);
    if (u instanceof Response) return u;
    const lista = db.horariosMisa
      .filter((m) => m.iglesiaId === iglesiaId && m.activo)
      .sort((a, b) => a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora))
      .map(aHorario);
    return HttpResponse.json({ data: lista });
  }),

  http.post(ruta('/iglesias/:iglesiaId/horario-misas'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:programar'], iglesiaId);
    if (u instanceof Response) return u;
    const datos = (await request.json()) as HorarioMisaEntrada;
    return guardarHorario(iglesiaId, {
      ...datos,
      idioma: datos.idioma ?? 'ESPANOL',
      duracionMin: datos.duracionMin ?? null,
    });
  }),

  http.patch(ruta('/iglesias/:iglesiaId/horario-misas/:id'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:programar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.horariosMisa.find(
      (m) => m.id === params['id'] && m.iglesiaId === iglesiaId && m.activo,
    );
    if (!actual)
      return errorApi(404, 'NOT_FOUND', 'La misa no está en el horario de esta iglesia.');
    const cambios = (await request.json()) as Partial<HorarioMisaEntrada>;
    return guardarHorario(iglesiaId, { ...actual, ...cambios }, actual.id);
  }),

  http.delete(ruta('/iglesias/:iglesiaId/horario-misas/:id'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:programar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.horariosMisa.find(
      (m) => m.id === params['id'] && m.iglesiaId === iglesiaId && m.activo,
    );
    if (!actual)
      return errorApi(404, 'NOT_FOUND', 'La misa no está en el horario de esta iglesia.');
    actual.activo = false;
    return new HttpResponse(null, { status: 204 });
  }),

  // ───────── Misa celebrada desde el horario (la forma del diezmo sigue en diezmo.ts) ─────────
  http.post(ruta('/iglesias/:iglesiaId/misas-celebradas'), async ({ request, params }) => {
    const datos = (await request.clone().json()) as {
      horarioMisaId?: string;
      fecha?: string;
      padreId?: string;
      motivo?: string;
    };
    if (!datos.horarioMisaId) return undefined; // forma del diezmo: la atiende diezmo.ts
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:registrar'], iglesiaId);
    if (u instanceof Response) return u;
    const h = db.horariosMisa.find(
      (m) => m.id === datos.horarioMisaId && m.iglesiaId === iglesiaId && m.activo,
    );
    if (!h) return errorApi(404, 'NOT_FOUND', 'La misa no está en el horario de esta iglesia.');
    const fecha = datos.fecha ?? '';
    const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    if (dia !== h.diaSemana) {
      return errorApi(
        422,
        'BUSINESS_RULE',
        `El ${fecha} es ${DIAS[dia]}, pero esa misa del horario es los ${DIAS[h.diaSemana]}.`,
      );
    }
    const inicio = new Date(`${fecha}T${h.hora}:00-06:00`).toISOString();
    if (inicio > ahora())
      return errorApi(422, 'BUSINESS_RULE', 'Solo se registran misas que ya empezaron.');
    if (db.misas.some((m) => m.iglesiaId === iglesiaId && m.inicio === inicio)) {
      return errorApi(409, 'CONFLICT', 'Esa misa ya está registrada en esa fecha.');
    }
    const real = datos.padreId ?? h.padreId;
    const id = `mi-${crypto.randomUUID()}`;
    db.misas.push({ id, iglesiaId, inicio, padreId: real });
    if (real !== h.padreId) {
      db.sustitucionesMisa[id] = {
        horarioMisaId: h.id,
        padreProgramadoId: h.padreId,
        motivo: datos.motivo ?? '',
        hechaPorId: u.id,
        hechaEn: ahora(),
      };
    }
    return HttpResponse.json(
      {
        data: {
          id,
          inicio,
          fechaLocal: fecha,
          horaLocal: h.hora,
          padre: padreDe(real),
          horarioMisaId: h.id,
          sustitucion: null,
          diezmo: null,
        },
      },
      { status: 201 },
    );
  }),

  // ───────── Servicios y pláticas ─────────
  http.get(ruta('/iglesias/:iglesiaId/servicios'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const lista = db.servicios
      .filter((s) => s.iglesiaId === iglesiaId && s.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(({ iglesiaId: _i, activo: _a, ...s }) => s);
    return HttpResponse.json({ data: lista });
  }),

  http.post(ruta('/iglesias/:iglesiaId/servicios'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const datos = (await request.json()) as ServicioEntrada;
    if (
      db.servicios.some(
        (s) =>
          s.iglesiaId === iglesiaId &&
          s.activo &&
          s.nombre.toLowerCase() === datos.nombre.toLowerCase(),
      )
    ) {
      return errorApi(409, 'CONFLICT', 'La iglesia ya tiene un servicio con ese nombre.', [
        { campo: 'nombre', mensaje: 'Usa otro nombre o edita el servicio que ya existe.' },
      ]);
    }
    const monto = datos.monto === null ? null : Number(datos.monto).toFixed(2);
    const nuevo = { ...datos, monto, id: `sv-${crypto.randomUUID()}`, iglesiaId, activo: true };
    db.servicios.push(nuevo);
    const { iglesiaId: _i, activo: _a, ...respuesta } = nuevo;
    return HttpResponse.json({ data: respuesta }, { status: 201 });
  }),

  http.patch(ruta('/iglesias/:iglesiaId/servicios/:id'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.servicios.find(
      (s) => s.id === params['id'] && s.iglesiaId === iglesiaId && s.activo,
    );
    if (!actual) return errorApi(404, 'NOT_FOUND', 'El servicio no existe en esta iglesia.');
    Object.assign(actual, (await request.json()) as Partial<ServicioEntrada>);
    if (actual.monto !== null) actual.monto = Number(actual.monto).toFixed(2);
    const { iglesiaId: _i, activo: _a, ...respuesta } = actual;
    return HttpResponse.json({ data: respuesta });
  }),

  http.delete(ruta('/iglesias/:iglesiaId/servicios/:id'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.servicios.find(
      (s) => s.id === params['id'] && s.iglesiaId === iglesiaId && s.activo,
    );
    if (!actual) return errorApi(404, 'NOT_FOUND', 'El servicio no existe en esta iglesia.');
    actual.activo = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(ruta('/iglesias/:iglesiaId/platicas'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const lista = db.platicas
      .filter((p) => p.iglesiaId === iglesiaId && p.activo)
      .map(({ iglesiaId: _i, activo: _a, padreId, ...p }) => ({
        ...p,
        padre: padreId ? padreDe(padreId) : null,
      }));
    return HttpResponse.json({ data: lista });
  }),

  http.post(ruta('/iglesias/:iglesiaId/platicas'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const datos = (await request.json()) as PlaticaEntrada;
    const nueva = {
      ...datos,
      costo: Number(datos.costo).toFixed(2),
      id: `pl-${crypto.randomUUID()}`,
      iglesiaId,
      activo: true,
    };
    db.platicas.push(nueva);
    return HttpResponse.json(
      { data: { ...nueva, padre: nueva.padreId ? padreDe(nueva.padreId) : null } },
      { status: 201 },
    );
  }),

  http.patch(ruta('/iglesias/:iglesiaId/platicas/:id'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.platicas.find(
      (p) => p.id === params['id'] && p.iglesiaId === iglesiaId && p.activo,
    );
    if (!actual) return errorApi(404, 'NOT_FOUND', 'La plática no existe en esta iglesia.');
    Object.assign(actual, (await request.json()) as Partial<PlaticaEntrada>);
    actual.costo = Number(actual.costo).toFixed(2);
    return HttpResponse.json({
      data: { ...actual, padre: actual.padreId ? padreDe(actual.padreId) : null },
    });
  }),

  http.delete(ruta('/iglesias/:iglesiaId/platicas/:id'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['servicios:gestionar'], iglesiaId);
    if (u instanceof Response) return u;
    const actual = db.platicas.find(
      (p) => p.id === params['id'] && p.iglesiaId === iglesiaId && p.activo,
    );
    if (!actual) return errorApi(404, 'NOT_FOUND', 'La plática no existe en esta iglesia.');
    actual.activo = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(ruta('/public/iglesias/:iglesiaId/platicas'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    if (!db.iglesias.some((i) => i.id === iglesiaId && i.activa))
      return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    const tipo = new URL(request.url).searchParams.get('tipo');
    return HttpResponse.json({
      data: platicasPublicas(iglesiaId).filter((p) => !tipo || p.tipo === tipo),
    });
  }),
];

// ───────── Lo que ve el público (también lo usa la ficha en explorar.ts) ─────────

export const misasPublicas = (iglesiaId: string) =>
  db.horariosMisa
    .filter((m) => m.iglesiaId === iglesiaId && m.activo)
    .sort((a, b) => a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora))
    .map((m) => {
      const p = padreDe(m.padreId);
      return {
        diaSemana: m.diaSemana,
        hora: m.hora,
        tipo: m.tipo,
        idioma: m.idioma,
        duracionMin: m.duracionMin,
        padre: p.titulo ? `${p.titulo} ${p.nombre}` : p.nombre,
      };
    });

export const serviciosPublicos = (iglesiaId: string) =>
  db.servicios
    .filter((s) => s.iglesiaId === iglesiaId && s.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(({ id: _id, iglesiaId: _i, activo: _a, ...s }) => s);

export const platicasPublicas = (iglesiaId: string) =>
  db.platicas
    .filter((p) => p.iglesiaId === iglesiaId && p.activo)
    .map(({ id: _id, iglesiaId: _i, activo: _a, padreId: _p, ...p }) => p);

// ───────── Deseables (Genaro): RF-84 semana desde el horario y RF-83 pláticas por municipio ─────────

function semanaMock(iglesiaId: string, semana: string | null) {
  const base = new Date(`${semana ?? ahora().slice(0, 10)}T12:00:00Z`);
  const domingo = new Date(base.getTime() - base.getUTCDay() * DIA).toISOString().slice(0, 10);
  const misas = db.horariosMisa
    .filter((m) => m.iglesiaId === iglesiaId && m.activo)
    .map((m) => {
      const fecha = new Date(new Date(`${domingo}T12:00:00Z`).getTime() + m.diaSemana * DIA)
        .toISOString()
        .slice(0, 10);
      const inicio = new Date(`${fecha}T${m.hora}:00-06:00`).toISOString();
      const hecha = db.misas.find((x) => x.iglesiaId === iglesiaId && x.inicio === inicio);
      return {
        horarioId: m.id,
        diaSemana: m.diaSemana,
        fecha,
        hora: m.hora,
        inicio,
        tipo: m.tipo,
        idioma: m.idioma,
        duracionMin: m.duracionMin,
        padreProgramado: padreDe(m.padreId),
        estado: hecha ? 'REGISTRADA' : inicio > ahora() ? 'FUTURA' : 'PENDIENTE',
        misaCelebrada: hecha
          ? {
              id: hecha.id,
              padre: padreDe(hecha.padreId),
              conSustitucion: Boolean(db.sustitucionesMisa[hecha.id]),
            }
          : null,
      };
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const hasta = new Date(new Date(`${domingo}T12:00:00Z`).getTime() + 6 * DIA)
    .toISOString()
    .slice(0, 10);
  return { semana: { desde: domingo, hasta }, misas };
}

export const deseablesHandlers = [
  http.get(ruta('/iglesias/:iglesiaId/semana-misas'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:leer'], iglesiaId);
    if (u instanceof Response) return u;
    return HttpResponse.json({
      data: semanaMock(iglesiaId, new URL(request.url).searchParams.get('semana')),
    });
  }),

  http.post(ruta('/iglesias/:iglesiaId/misas-celebradas/semana'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = acceso(request, ['misas:registrar'], iglesiaId);
    if (u instanceof Response) return u;
    const { semana } = (await request.json()) as { semana?: string };
    const s = semanaMock(iglesiaId, semana ?? null);
    let creadas = 0;
    for (const m of s.misas.filter((x) => x.estado === 'PENDIENTE')) {
      db.misas.push({
        id: `mi-${crypto.randomUUID()}`,
        iglesiaId,
        inicio: m.inicio,
        padreId: m.padreProgramado.id,
      });
      creadas++;
    }
    return HttpResponse.json({
      data: {
        semana: s.semana,
        creadas,
        yaRegistradas: s.misas.filter((x) => x.estado === 'REGISTRADA').length,
        futuras: s.misas.filter((x) => x.estado === 'FUTURA').length,
        omitidas: [],
      },
    });
  }),

  http.get(ruta('/public/platicas'), ({ request }) => {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');
    const municipio = url.searchParams.get('municipio') ?? '';
    if (!tipo || !/^\d{5}$/.test(municipio)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Elige un tipo de plática y un municipio.');
    }
    const data = db.iglesias
      .filter((i) => i.activa && i.municipio?.clave === municipio)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((i) => ({
        iglesia: { id: i.id, nombre: i.nombre, tipo: i.tipo },
        platicas: platicasPublicas(i.id).filter((p) => p.tipo === tipo),
      }))
      .filter((g) => g.platicas.length > 0);
    return HttpResponse.json({ data });
  }),
];
