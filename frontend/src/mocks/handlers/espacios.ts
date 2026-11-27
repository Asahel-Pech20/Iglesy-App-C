import { http, HttpResponse } from 'msw';
import type { DetalleError } from '@/app/tipos/comunes';
import type {
  ClaseEspacio,
  Cotizacion,
  EstadoSolicitud,
  RespuestaSolicitud,
  SeguimientoSolicitud,
  SolicitudEspacio,
} from '@/app/tipos/espacios';
import {
  type CotizacionMock,
  DIA_MS,
  type SolicitudEspacioMock,
  VIGENCIA_DIAS,
} from '../datos/espacios';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';
import { fechaYHoraLocal } from '../zona';

// Simulación de backend/src/modules/espacios: mismas reglas, mismos códigos de error y mismo
// contrato (folio y clave, bloqueo por folio, vencimiento guardado antes del 422, iglesia cerrada).

const CLASES: ClaseEspacio[] = ['CRIPTA', 'NICHO', 'COLUMBARIO', 'OSARIO'];
const ESTADOS: EstadoSolicitud[] = [
  'RECIBIDA',
  'SIN_LUGAR',
  'COTIZADA',
  'ACEPTADA',
  'RECHAZADA',
  'VENCIDA',
  'CANCELADA',
];
const INTENTOS_ANTES_DE_BLOQUEAR = 5;
const MINUTOS_DE_BLOQUEO = 15;
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;
const TELEFONO = /^[0-9+()\-\s]{7,20}$/;
const MENSAJE_ACCESO = 'El folio o la clave no son correctos.';
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  RECIBIDA: 'Recibida',
  SIN_LUGAR: 'Sin lugar',
  COTIZADA: 'Cotizada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

const normalizarClave = (t: string) => t.replace(/[\s-]/g, '').toUpperCase();
const mostrarClave = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;

// ───────── Ayudas ─────────
const iglesiaDe = (id: string) => db.iglesias.find((i) => i.id === id);
const zonaDe = (iglesiaId: string) => iglesiaDe(iglesiaId)?.zonaHoraria ?? 'America/Mexico_City';
const local = (instante: string, zona: string) => fechaYHoraLocal(new Date(instante), zona);

const cotizacionesDe = (s: SolicitudEspacioMock) =>
  db.cotizacionesEspacio
    .filter((c) => c.solicitudId === s.id)
    .sort((a, b) => b.emitidaEn.localeCompare(a.emitidaEn));
const sinRespuesta = (s: SolicitudEspacioMock) =>
  cotizacionesDe(s).find((c) => c.respuesta === null);
const venció = (c: CotizacionMock, instante: Date) =>
  new Date(c.venceEn).getTime() <= instante.getTime();

/** Estado que se ve: una cotizada cuya cotización venció cuenta como VENCIDA aunque no se haya guardado */
function estadoEfectivo(s: SolicitudEspacioMock, instante: Date): EstadoSolicitud {
  if (s.estado !== 'COTIZADA') return s.estado;
  const abierta = sinRespuesta(s);
  return abierta && venció(abierta, instante) ? 'VENCIDA' : 'COTIZADA';
}

function aCotizacion(c: CotizacionMock, zona: string, instante: Date): Cotizacion {
  return {
    monto: Number(c.monto).toFixed(2),
    condiciones: c.condiciones,
    emitidaEn: c.emitidaEn,
    venceEn: c.venceEn,
    emitidaLocal: local(c.emitidaEn, zona),
    venceLocal: local(c.venceEn, zona),
    respuesta: c.respuesta,
    vigente: c.respuesta === null && !venció(c, instante),
  };
}

function aVistaPanel(s: SolicitudEspacioMock, instante: Date): SolicitudEspacio {
  const zona = zonaDe(s.iglesiaId);
  const tipo = db.tiposEspacio.find((t) => t.id === s.tipoEspacioId)!;
  const ultima = cotizacionesDe(s)[0];
  return {
    id: s.id,
    folio: s.folio,
    estado: estadoEfectivo(s, instante),
    tipo: { id: tipo.id, clase: tipo.clase },
    contacto: { nombre: s.contactoNombre, telefono: s.contactoTelefono, correo: s.contactoCorreo },
    comentarios: s.comentarios,
    creadaEn: s.createdAt,
    creadaLocal: local(s.createdAt, zona),
    cotizacion: ultima ? aCotizacion(ultima, zona, instante) : null,
  };
}

function aVistaPublica(s: SolicitudEspacioMock, instante: Date): SeguimientoSolicitud {
  const zona = zonaDe(s.iglesiaId);
  const tipo = db.tiposEspacio.find((t) => t.id === s.tipoEspacioId)!;
  const iglesia = iglesiaDe(s.iglesiaId)!;
  const ultima = cotizacionesDe(s)[0];
  return {
    folio: s.folio,
    estado: estadoEfectivo(s, instante),
    tipo: { clase: tipo.clase },
    iglesia: {
      nombre: iglesia.nombre,
      telefono: '9999000000',
      correo: 'parroquia@ejemplo.mx',
    },
    creadaEn: s.createdAt,
    creadaLocal: local(s.createdAt, zona),
    cotizacion: ultima ? aCotizacion(ultima, zona, instante) : null,
  };
}

/** Guarda el vencimiento (la solicitud pasa a VENCIDA) ANTES de responder 422: no se deshace con el error */
function guardarVencimiento(s: SolicitudEspacioMock) {
  const abierta = sinRespuesta(s);
  if (!abierta) return;
  s.estado = 'VENCIDA';
  abierta.respuesta = 'VENCIDA';
  abierta.respondidaEn = abierta.venceEn;
}

/** Aceptar, rechazar o cancelar: la misma regla con folio y clave o desde la cuenta del cliente. */
function responderSolicitud(s: SolicitudEspacioMock, accion: RespuestaSolicitud, instante: Date) {
  if (iglesiaDe(s.iglesiaId)?.activa === false) {
    return errorApi(
      422,
      'BUSINESS_RULE',
      'Esta iglesia ya no recibe respuestas a sus solicitudes.',
    );
  }
  // Cotización vencida: se guarda ese estado primero y después se responde 422
  if (s.estado === 'COTIZADA' && estadoEfectivo(s, instante) === 'VENCIDA') {
    guardarVencimiento(s);
    return errorApi(
      422,
      'BUSINESS_RULE',
      'La cotización venció. Haz una nueva solicitud si todavía te interesa.',
    );
  }
  const permitido = accion === 'cancelar' ? ['RECIBIDA', 'COTIZADA'] : ['COTIZADA'];
  if (!permitido.includes(s.estado)) {
    return errorApi(
      422,
      'BUSINESS_RULE',
      `No se puede ${accion} una solicitud en estado «${ETIQUETA_ESTADO[s.estado]}».`,
    );
  }
  const abierta = sinRespuesta(s);
  s.estado = accion === 'aceptar' ? 'ACEPTADA' : accion === 'rechazar' ? 'RECHAZADA' : 'CANCELADA';
  if (accion !== 'cancelar' && abierta) {
    abierta.respuesta = accion === 'aceptar' ? 'ACEPTADA' : 'RECHAZADA';
    abierta.respondidaEn = ahora();
  }
  return HttpResponse.json({ data: aVistaPublica(s, instante) });
}

const MONTO_ERROR: DetalleError = {
  campo: 'monto',
  mensaje: 'Monto no válido (hasta 2 decimales).',
};

/** Usuario con el permiso y de la iglesia de la ruta, o la respuesta 401/403/422 lista para devolver. */
function conAlcance(
  request: Request,
  iglesiaId: string,
  permiso: Parameters<typeof autenticar>[1],
) {
  const usuario = autenticar(request, permiso);
  if (usuario instanceof Response) return usuario;
  // Datos privados: la Coordinación (sin iglesia) y el personal de otra iglesia no entran
  if (usuario.iglesiaId !== iglesiaId) {
    return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  }
  const escribe = !['GET', 'HEAD'].includes(request.method);
  if (escribe && iglesiaDe(iglesiaId)?.activa === false) {
    return errorApi(422, 'BUSINESS_RULE', 'Una iglesia cerrada ya no acepta cambios.');
  }
  return usuario;
}

const solicitudDeLaIglesia = (iglesiaId: string, id: string) =>
  db.solicitudesEspacio.find((s) => s.id === id && s.iglesiaId === iglesiaId);
const noExisteSolicitud = () => errorApi(404, 'NOT_FOUND', 'La solicitud no existe.');

// ───────── Acceso con folio y clave ─────────
function verificarAcceso(
  folio: string,
  clave: string,
  instante: Date,
): SolicitudEspacioMock | Response {
  const s = db.solicitudesEspacio.find((x) => x.folio === folio.trim().toUpperCase());
  if (!s) return errorApi(404, 'NOT_FOUND', MENSAJE_ACCESO);
  if (s.bloqueadoHasta && new Date(s.bloqueadoHasta).getTime() > instante.getTime()) {
    const minutos = Math.ceil((new Date(s.bloqueadoHasta).getTime() - instante.getTime()) / 60_000);
    return errorApi(
      429,
      'RATE_LIMITED',
      `Demasiados intentos con este folio. Vuelve a intentarlo en ${minutos} minuto(s).`,
    );
  }
  if (normalizarClave(clave) !== normalizarClave(s.clave)) {
    if (s.bloqueadoHasta && new Date(s.bloqueadoHasta).getTime() <= instante.getTime()) {
      s.intentosFallidos = 0;
      s.bloqueadoHasta = null;
    }
    s.intentosFallidos += 1;
    if (s.intentosFallidos >= INTENTOS_ANTES_DE_BLOQUEAR) {
      s.bloqueadoHasta = new Date(instante.getTime() + MINUTOS_DE_BLOQUEO * 60_000).toISOString();
    }
    return errorApi(404, 'NOT_FOUND', MENSAJE_ACCESO);
  }
  s.intentosFallidos = 0;
  s.bloqueadoHasta = null;
  return s;
}

function nuevaClave() {
  let c = '';
  for (let i = 0; i < 10; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return c;
}

let consecutivo = 100;

export const espaciosHandlers = [
  // ═════════ Panel ═════════
  http.get(ruta('/iglesias/:iglesiaId/tipos-espacio'), ({ request, params }) => {
    const u = conAlcance(request, String(params['iglesiaId']), 'espacios:leer');
    if (u instanceof Response) return u;
    const lista = db.tiposEspacio
      .filter((t) => t.iglesiaId === params['iglesiaId'])
      .sort((a, b) => CLASES.indexOf(a.clase) - CLASES.indexOf(b.clase))
      .map(({ iglesiaId: _i, ...t }) => t);
    return HttpResponse.json({ data: lista });
  }),

  http.post(ruta('/iglesias/:iglesiaId/tipos-espacio'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = conAlcance(request, iglesiaId, 'espacios:gestionar');
    if (u instanceof Response) return u;
    const cuerpo = (await request.json()) as { clase?: ClaseEspacio; disponible?: boolean };
    if (!cuerpo.clase || !CLASES.includes(cuerpo.clase)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'clase', mensaje: 'Elige: cripta, nicho, columbario u osario.' },
      ]);
    }
    if (db.tiposEspacio.some((t) => t.iglesiaId === iglesiaId && t.clase === cuerpo.clase)) {
      return errorApi(
        409,
        'CONFLICT',
        'Tu iglesia ya tiene ese tipo de espacio. Edítalo o reactívalo.',
      );
    }
    const tipo = {
      id: crypto.randomUUID(),
      iglesiaId,
      clase: cuerpo.clase,
      activo: true,
      disponible: cuerpo.disponible ?? true,
    };
    db.tiposEspacio.push(tipo);
    const { iglesiaId: _i, ...vista } = tipo;
    return HttpResponse.json({ data: vista }, { status: 201 });
  }),

  http.patch(ruta('/iglesias/:iglesiaId/tipos-espacio/:id'), async ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = conAlcance(request, iglesiaId, 'espacios:gestionar');
    if (u instanceof Response) return u;
    const tipo = db.tiposEspacio.find((t) => t.id === params['id'] && t.iglesiaId === iglesiaId);
    if (!tipo) return errorApi(404, 'NOT_FOUND', 'El tipo de espacio no existe.');
    const cambios = (await request.json()) as { activo?: boolean; disponible?: boolean };
    if (cambios.activo === undefined && cambios.disponible === undefined) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { mensaje: 'No hay nada que cambiar.' },
      ]);
    }
    if (cambios.activo !== undefined) tipo.activo = cambios.activo;
    if (cambios.disponible !== undefined) tipo.disponible = cambios.disponible;
    const { iglesiaId: _i, ...vista } = tipo;
    return HttpResponse.json({ data: vista });
  }),

  http.get(ruta('/iglesias/:iglesiaId/solicitudes-espacio'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = conAlcance(request, iglesiaId, 'espacios:leer');
    if (u instanceof Response) return u;
    const url = new URL(request.url);
    const estado = url.searchParams.get('estado');
    if (estado && !ESTADOS.includes(estado as EstadoSolicitud)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'estado', mensaje: 'Estado no válido.' },
      ]);
    }
    const instante = new Date();
    const lista = db.solicitudesEspacio
      .filter((s) => s.iglesiaId === iglesiaId)
      .filter((s) => !estado || estadoEfectivo(s, instante) === estado)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((s) => aVistaPanel(s, instante));
    return paginarMock(lista, url);
  }),

  http.get(ruta('/iglesias/:iglesiaId/solicitudes-espacio/:id'), ({ request, params }) => {
    const iglesiaId = String(params['iglesiaId']);
    const u = conAlcance(request, iglesiaId, 'espacios:leer');
    if (u instanceof Response) return u;
    const s = solicitudDeLaIglesia(iglesiaId, String(params['id']));
    if (!s) return noExisteSolicitud();
    return HttpResponse.json({ data: aVistaPanel(s, new Date()) });
  }),

  http.post(
    ruta('/iglesias/:iglesiaId/solicitudes-espacio/:id/cotizacion'),
    async ({ request, params }) => {
      const iglesiaId = String(params['iglesiaId']);
      const u = conAlcance(request, iglesiaId, 'espacios:gestionar');
      if (u instanceof Response) return u;
      const s = solicitudDeLaIglesia(iglesiaId, String(params['id']));
      if (!s) return noExisteSolicitud();
      const cuerpo = (await request.json()) as { monto?: unknown; condiciones?: unknown };
      const errores: DetalleError[] = [];
      const monto = typeof cuerpo.monto === 'string' ? cuerpo.monto.trim() : '';
      if (!FORMATO_MONTO.test(monto)) errores.push(MONTO_ERROR);
      else if (Number(monto) <= 0) {
        errores.push({ campo: 'monto', mensaje: 'El monto debe ser mayor que cero.' });
      }
      const condiciones = typeof cuerpo.condiciones === 'string' ? cuerpo.condiciones.trim() : '';
      if (!condiciones) {
        errores.push({
          campo: 'condiciones',
          mensaje: 'Escribe las condiciones de la cotización.',
        });
      }
      if (errores.length > 0) {
        return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', errores);
      }
      const instante = new Date();
      // Al escribir, una cotización vencida se guarda primero y después se responde 422
      if (s.estado === 'COTIZADA' && estadoEfectivo(s, instante) === 'VENCIDA')
        guardarVencimiento(s);
      if (s.estado !== 'RECIBIDA') {
        return errorApi(
          422,
          'BUSINESS_RULE',
          `No se puede cotizar una solicitud en estado «${ETIQUETA_ESTADO[s.estado]}».`,
        );
      }
      s.estado = 'COTIZADA';
      db.cotizacionesEspacio.push({
        id: crypto.randomUUID(),
        solicitudId: s.id,
        monto: Number(monto).toFixed(2),
        condiciones,
        emitidaEn: instante.toISOString(),
        venceEn: new Date(instante.getTime() + VIGENCIA_DIAS * DIA_MS).toISOString(),
        respuesta: null,
        respondidaEn: null,
      });
      return HttpResponse.json({ data: aVistaPanel(s, instante) }, { status: 201 });
    },
  ),

  http.post(
    ruta('/iglesias/:iglesiaId/solicitudes-espacio/:id/sin-lugar'),
    ({ request, params }) => {
      const iglesiaId = String(params['iglesiaId']);
      const u = conAlcance(request, iglesiaId, 'espacios:gestionar');
      if (u instanceof Response) return u;
      const s = solicitudDeLaIglesia(iglesiaId, String(params['id']));
      if (!s) return noExisteSolicitud();
      const instante = new Date();
      if (s.estado === 'COTIZADA' && estadoEfectivo(s, instante) === 'VENCIDA')
        guardarVencimiento(s);
      if (s.estado !== 'RECIBIDA') {
        return errorApi(
          422,
          'BUSINESS_RULE',
          `No se puede marcar sin lugar una solicitud en estado «${ETIQUETA_ESTADO[s.estado]}».`,
        );
      }
      s.estado = 'SIN_LUGAR';
      return HttpResponse.json({ data: aVistaPanel(s, instante) });
    },
  ),

  // ═════════ Público ═════════
  http.get(ruta('/public/iglesias/:iglesiaId/espacios'), ({ params }) => {
    const iglesia = iglesiaDe(String(params['iglesiaId']));
    if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    const tipos = iglesia.activa
      ? db.tiposEspacio
          .filter((t) => t.iglesiaId === iglesia.id && t.activo && t.disponible)
          .sort((a, b) => CLASES.indexOf(a.clase) - CLASES.indexOf(b.clase))
          .map((t) => ({ id: t.id, clase: t.clase }))
      : [];
    return HttpResponse.json({
      data: { iglesia: { id: iglesia.id, nombre: iglesia.nombre }, tipos },
    });
  }),

  http.post(
    ruta('/public/iglesias/:iglesiaId/solicitudes-espacio'),
    async ({ request, params }) => {
      const iglesia = iglesiaDe(String(params['iglesiaId']));
      if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
      const cuerpo = (await request.json()) as {
        tipoEspacioId?: string;
        contacto?: { nombre?: string; telefono?: string; correo?: string };
        comentarios?: string;
      };
      const errores: DetalleError[] = [];
      const c = cuerpo.contacto ?? {};
      if (!c.nombre?.trim())
        errores.push({ campo: 'contacto.nombre', mensaje: 'Escribe tu nombre.' });
      if (c.telefono && !TELEFONO.test(c.telefono.trim())) {
        errores.push({ campo: 'contacto.telefono', mensaje: 'Teléfono no válido.' });
      }
      if (c.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.correo.trim())) {
        errores.push({ campo: 'contacto.correo', mensaje: 'Correo no válido.' });
      }
      if (!c.telefono?.trim() && !c.correo?.trim()) {
        errores.push({
          campo: 'contacto.telefono',
          mensaje: 'Deja un teléfono o un correo para que la iglesia pueda responderte.',
        });
      }
      if (!cuerpo.tipoEspacioId) {
        errores.push({ campo: 'tipoEspacioId', mensaje: 'Identificador no válido.' });
      }
      if (errores.length > 0) {
        return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', errores);
      }
      // Las rutas públicas no pasan por el alcance: la iglesia cerrada se revisa aquí
      if (!iglesia.activa) {
        return errorApi(422, 'BUSINESS_RULE', 'Esta iglesia ya no recibe solicitudes.');
      }
      const tipo = db.tiposEspacio.find(
        (t) => t.id === cuerpo.tipoEspacioId && t.iglesiaId === iglesia.id,
      );
      if (!tipo) return errorApi(404, 'NOT_FOUND', 'Esa iglesia no ofrece ese tipo de espacio.');
      if (!tipo.activo || !tipo.disponible) {
        return errorApi(422, 'BUSINESS_RULE', 'Ese tipo de espacio no está disponible por ahora.');
      }
      consecutivo += 1;
      const instante = new Date();
      const clave = nuevaClave();
      const folio = `ESP-${instante.getFullYear()}-${String(consecutivo).padStart(6, '0')}`;
      db.solicitudesEspacio.push({
        id: crypto.randomUUID(),
        folio,
        clave,
        iglesiaId: iglesia.id,
        tipoEspacioId: tipo.id,
        contactoNombre: c.nombre!.trim(),
        contactoTelefono: c.telefono?.trim() || null,
        contactoCorreo: c.correo?.trim().toLowerCase() || null,
        comentarios: cuerpo.comentarios?.trim() || null,
        estado: 'RECIBIDA',
        intentosFallidos: 0,
        bloqueadoHasta: null,
        createdAt: instante.toISOString(),
      });
      return HttpResponse.json(
        {
          data: {
            folio,
            clave: mostrarClave(clave),
            estado: 'RECIBIDA',
            iglesia: { nombre: iglesia.nombre },
            aviso: 'Guarda tu folio y tu clave: la clave no se vuelve a mostrar.',
          },
        },
        { status: 201 },
      );
    },
  ),

  http.post(ruta('/public/solicitudes-espacio/:folio/consulta'), async ({ request, params }) => {
    const { clave } = (await request.json()) as { clave?: string };
    if (!clave?.trim()) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'clave', mensaje: 'Escribe la clave.' },
      ]);
    }
    const instante = new Date();
    const s = verificarAcceso(String(params['folio']), clave, instante);
    if (s instanceof Response) return s;
    return HttpResponse.json({ data: aVistaPublica(s, instante) });
  }),

  ...(['aceptar', 'rechazar', 'cancelar'] as RespuestaSolicitud[]).map((accion) =>
    http.post(ruta(`/public/solicitudes-espacio/:folio/${accion}`), async ({ request, params }) => {
      const { clave } = (await request.json()) as { clave?: string };
      if (!clave?.trim()) {
        return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
          { campo: 'clave', mensaje: 'Escribe la clave.' },
        ]);
      }
      const instante = new Date();
      const s = verificarAcceso(String(params['folio']), clave, instante);
      if (s instanceof Response) return s;
      return responderSolicitud(s, accion, instante);
    }),
  ),

  // ───────── PROPUESTA: cuenta de cliente (solo mocks; specs.md §12.3) ─────────
  // Sus solicitudes son las que hizo con el correo de su cuenta; no necesita folio ni clave
  http.get(ruta('/mis-solicitudes'), ({ request }) => {
    const usuario = autenticar(request, 'solicitudes:propias');
    if (usuario instanceof Response) return usuario;
    const instante = new Date();
    const lista = db.solicitudesEspacio
      .filter((x) => x.contactoCorreo === usuario.email)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((x) => aVistaPublica(x, instante));
    return paginarMock(lista, new URL(request.url));
  }),

  ...(['aceptar', 'rechazar', 'cancelar'] as RespuestaSolicitud[]).map((accion) =>
    http.post(ruta(`/mis-solicitudes/:folio/${accion}`), ({ request, params }) => {
      const usuario = autenticar(request, 'solicitudes:propias');
      if (usuario instanceof Response) return usuario;
      const s = db.solicitudesEspacio.find(
        (x) => x.folio === params['folio'] && x.contactoCorreo === usuario.email,
      );
      // De otra persona o inexistente: lo mismo, para no revelar folios ajenos
      if (!s) return errorApi(404, 'NOT_FOUND', 'No encontramos esa solicitud en tu cuenta.');
      return responderSolicitud(s, accion, new Date());
    }),
  ),
];
