// Criptas, nichos, columbarios y osarios (RF-70–RF-80, RN-47–RN-53). Toda la lógica y el único
// acceso a la BD. Las reglas puras viven en dominio/: aquí se arma el contexto (BD, ahora) y los
// resultados se traducen a AppError. El «ahora» entra por parámetro y el vencimiento se evalúa al
// leer y al escribir, sin tareas programadas.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { fechaYHoraLocal } from '../../lib/dominio/zona';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import { hashToken } from '../../lib/seguridad';
import {
  claveDesdeBytes,
  evaluarBloqueo,
  formatearFolio,
  mostrarClave,
  normalizarClave,
  normalizarFolio,
  trasIntentoFallido,
} from './dominio/acceso';
import { estadoEfectivo, evaluarTransicion } from './dominio/solicitud-espacio';
import { SUPUESTOS_ACCESO } from './dominio/supuestos';
import type { Accion, EstadoSolicitud, MotivoRechazo, SolicitudDominio } from './dominio/tipos';
import { fechaVencimiento } from './dominio/vigencia-cotizacion';
import type {
  CrearSolicitud,
  CrearTipo,
  CuerpoCotizar,
  EditarTipo,
  QueryListarSolicitudes,
} from './espacios.schemas';

const MENSAJE_ACCESO = 'El folio o la clave no son correctos.';

const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  RECIBIDA: 'Recibida',
  SIN_LUGAR: 'Sin lugar',
  COTIZADA: 'Cotizada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

// ───────── Selecciones ─────────

const SELECT_COTIZACION = {
  id: true,
  monto: true,
  condiciones: true,
  emitidaEn: true,
  venceEn: true,
  respuesta: true,
  respondidaEn: true,
} satisfies Prisma.CotizacionSelect;

const SELECT_SOLICITUD = {
  id: true,
  folio: true,
  estado: true,
  createdAt: true,
  contactoNombre: true,
  contactoTelefono: true,
  contactoCorreo: true,
  comentarios: true,
  intentosFallidos: true,
  bloqueadoHasta: true,
  claveHash: true,
  tipoEspacio: { select: { id: true, clase: true } },
  iglesia: {
    select: {
      id: true,
      nombre: true,
      zonaHoraria: true,
      activa: true,
      telefono: true,
      correo: true,
    },
  },
  // La más reciente primero: la vigente (sin respuesta) o, si no hay, la última que hubo
  cotizaciones: { orderBy: { emitidaEn: 'desc' }, select: SELECT_COTIZACION },
} satisfies Prisma.SolicitudEspacioSelect;

type FilaSolicitud = Prisma.SolicitudEspacioGetPayload<{ select: typeof SELECT_SOLICITUD }>;
type FilaCotizacion = FilaSolicitud['cotizaciones'][number];

// ───────── Traducciones ─────────

const local = (instante: Date, zona: string) => {
  const { fecha, hora } = fechaYHoraLocal(instante, zona);
  return { fecha, hora };
};

/** La cotización sin respuesta de la solicitud (la vigente o la que venció sin guardarse). */
const cotizacionSinRespuesta = (s: FilaSolicitud): FilaCotizacion | undefined =>
  s.cotizaciones.find((c) => c.respuesta === null);

function dominioDe(s: FilaSolicitud): SolicitudDominio {
  const abierta = cotizacionSinRespuesta(s);
  return {
    estado: s.estado,
    cotizacion: abierta ? { emitidaEn: abierta.emitidaEn } : null,
  };
}

const estadoDe = (s: FilaSolicitud, ahora: Date): EstadoSolicitud =>
  // Una solicitud cotizada sin su cotización no debería existir; se deja como está
  s.estado === 'COTIZADA' && !cotizacionSinRespuesta(s)
    ? s.estado
    : estadoEfectivo(dominioDe(s), ahora);

function aCotizacion(c: FilaCotizacion, zona: string, ahora: Date) {
  return {
    monto: c.monto.toFixed(2),
    condiciones: c.condiciones,
    emitidaEn: c.emitidaEn,
    venceEn: c.venceEn,
    emitidaLocal: local(c.emitidaEn, zona),
    venceLocal: local(c.venceEn, zona),
    respuesta: c.respuesta,
    vigente: c.respuesta === null && c.venceEn.getTime() > ahora.getTime(),
  };
}

/** Vista de la solicitud para el personal de la iglesia: con los datos de contacto (RN-53). */
function aVistaPanel(s: FilaSolicitud, ahora: Date) {
  const zona = s.iglesia.zonaHoraria;
  const cotizacion = s.cotizaciones[0];
  return {
    id: s.id,
    folio: s.folio,
    estado: estadoDe(s, ahora),
    tipo: s.tipoEspacio,
    contacto: {
      nombre: s.contactoNombre,
      telefono: s.contactoTelefono,
      correo: s.contactoCorreo,
    },
    comentarios: s.comentarios,
    creadaEn: s.createdAt,
    creadaLocal: local(s.createdAt, zona),
    cotizacion: cotizacion ? aCotizacion(cotizacion, zona, ahora) : null,
  };
}

/** Vista para quien hizo la solicitud: nunca incluye la clave, su hash ni los intentos. */
function aVistaPublica(s: FilaSolicitud, ahora: Date) {
  const zona = s.iglesia.zonaHoraria;
  const cotizacion = s.cotizaciones[0];
  return {
    folio: s.folio,
    estado: estadoDe(s, ahora),
    tipo: { clase: s.tipoEspacio.clase },
    // «Con quién se hace»: la iglesia a la que se pidió y cómo comunicarse con ella
    iglesia: { nombre: s.iglesia.nombre, telefono: s.iglesia.telefono, correo: s.iglesia.correo },
    creadaEn: s.createdAt,
    creadaLocal: local(s.createdAt, zona),
    cotizacion: cotizacion ? aCotizacion(cotizacion, zona, ahora) : null,
  };
}

function errorDeTransicion(motivo: MotivoRechazo, accion: Accion, estado: EstadoSolicitud) {
  switch (motivo) {
    case 'ACTOR_NO_AUTORIZADO':
      return AppError.prohibido();
    case 'COTIZACION_VENCIDA':
      return AppError.reglaNegocio(
        'La cotización venció. Haz una nueva solicitud si todavía te interesa.',
      );
    case 'COTIZACION_VIGENTE':
      return AppError.reglaNegocio('La cotización todavía está vigente.');
    case 'TRANSICION_NO_PERMITIDA': {
      const que: Record<Accion, string> = {
        COTIZAR: 'cotizar',
        MARCAR_SIN_LUGAR: 'marcar sin lugar',
        ACEPTAR: 'aceptar',
        RECHAZAR: 'rechazar',
        CANCELAR: 'cancelar',
        VENCER: 'vencer',
      };
      return AppError.reglaNegocio(
        `No se puede ${que[accion]} una solicitud en estado «${ETIQUETA_ESTADO[estado]}».`,
      );
    }
  }
}

// ───────── Lecturas comunes ─────────

async function solicitudDeLaIglesia(iglesiaId: string, id: string) {
  const s = await prisma.solicitudEspacio.findFirst({
    where: { id, iglesiaId },
    select: SELECT_SOLICITUD,
  });
  // De otra iglesia o inexistente: se responde igual, sin revelar cuál es (RN-54)
  if (!s) throw AppError.noEncontrado('La solicitud no existe.');
  return s;
}

/**
 * Guarda el vencimiento de una cotizada cuya cotización ya venció: la solicitud pasa a VENCIDA y su
 * cotización queda con esa respuesta. Corre en su propia transacción y termina (confirma) antes de
 * que quien llama responda 422: así el cambio no se deshace con el error.
 */
async function guardarVencimiento(s: FilaSolicitud): Promise<void> {
  const abierta = cotizacionSinRespuesta(s);
  if (!abierta) return;
  await prisma.$transaction([
    prisma.solicitudEspacio.updateMany({
      where: { id: s.id, estado: 'COTIZADA' },
      data: { estado: 'VENCIDA' },
    }),
    prisma.cotizacion.updateMany({
      where: { id: abierta.id, respuesta: null },
      data: { respuesta: 'VENCIDA', respondidaEn: abierta.venceEn },
    }),
  ]);
}

/** Si la cotización ya venció sin guardarse, la guarda y avisa con 422 (el cambio ya está confirmado). */
async function exigirNoVencida(s: FilaSolicitud, ahora: Date): Promise<void> {
  if (s.estado === 'COTIZADA' && estadoDe(s, ahora) === 'VENCIDA') {
    await guardarVencimiento(s);
    throw errorDeTransicion('COTIZACION_VENCIDA', 'ACEPTAR', 'VENCIDA');
  }
}

// ═════════════════ Panel de la iglesia ═════════════════

export function listarTipos(iglesiaId: string) {
  return prisma.tipoEspacio.findMany({
    where: { iglesiaId },
    orderBy: { clase: 'asc' },
    select: { id: true, clase: true, activo: true, disponible: true },
  });
}

export async function crearTipo(iglesiaId: string, datos: CrearTipo) {
  try {
    return await prisma.tipoEspacio.create({
      data: { iglesiaId, clase: datos.clase, disponible: datos.disponible ?? true },
      select: { id: true, clase: true, activo: true, disponible: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflicto('Tu iglesia ya tiene ese tipo de espacio. Edítalo o reactívalo.');
    }
    throw error;
  }
}

export async function editarTipo(iglesiaId: string, id: string, datos: EditarTipo) {
  const existe = await prisma.tipoEspacio.findFirst({
    where: { id, iglesiaId },
    select: { id: true },
  });
  if (!existe) throw AppError.noEncontrado('El tipo de espacio no existe.');
  return prisma.tipoEspacio.update({
    where: { id },
    data: datos,
    select: { id: true, clase: true, activo: true, disponible: true },
  });
}

export async function listarSolicitudes(
  iglesiaId: string,
  query: QueryListarSolicitudes,
  ahora: Date,
) {
  const { page, limit, skip, take } = paginar(query);
  // El estado que se ve es el efectivo: una cotizada vencida cuenta como VENCIDA aunque no se guarde
  const vencida: Prisma.SolicitudEspacioWhereInput = {
    estado: 'COTIZADA',
    cotizaciones: { some: { respuesta: null, venceEn: { lte: ahora } } },
  };
  const filtroEstado: Prisma.SolicitudEspacioWhereInput =
    query.estado === 'VENCIDA'
      ? { OR: [{ estado: 'VENCIDA' }, vencida] }
      : query.estado === 'COTIZADA'
        ? { estado: 'COTIZADA', NOT: vencida }
        : query.estado
          ? { estado: query.estado }
          : {};
  const where: Prisma.SolicitudEspacioWhereInput = { iglesiaId, ...filtroEstado };
  const [total, filas] = await Promise.all([
    prisma.solicitudEspacio.count({ where }),
    prisma.solicitudEspacio.findMany({
      where,
      select: SELECT_SOLICITUD,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
  ]);
  return { datos: filas.map((s) => aVistaPanel(s, ahora)), meta: crearMeta(total, page, limit) };
}

export async function obtenerSolicitud(iglesiaId: string, id: string, ahora: Date) {
  return aVistaPanel(await solicitudDeLaIglesia(iglesiaId, id), ahora);
}

/** RF-76: avisa que no hay lugar. Solo desde «Recibida». */
export async function marcarSinLugar(iglesiaId: string, id: string, ahora: Date) {
  const s = await solicitudDeLaIglesia(iglesiaId, id);
  await exigirNoVencida(s, ahora);
  const r = evaluarTransicion(dominioDe(s), 'MARCAR_SIN_LUGAR', 'ADMINISTRADOR', ahora);
  if (!r.ok) throw errorDeTransicion(r.motivo, 'MARCAR_SIN_LUGAR', estadoDe(s, ahora));
  const { count } = await prisma.solicitudEspacio.updateMany({
    where: { id, iglesiaId, estado: s.estado },
    data: { estado: r.estadoNuevo },
  });
  if (count !== 1)
    throw AppError.conflicto('La solicitud cambió mientras la revisabas. Ábrela de nuevo.');
  return obtenerSolicitud(iglesiaId, id, ahora);
}

/** RF-77: cotiza (cuánto cuesta y en qué condiciones). Solo desde «Recibida». Vale 15 días. */
export async function cotizar(iglesiaId: string, id: string, datos: CuerpoCotizar, ahora: Date) {
  const s = await solicitudDeLaIglesia(iglesiaId, id);
  await exigirNoVencida(s, ahora);
  const r = evaluarTransicion(dominioDe(s), 'COTIZAR', 'ADMINISTRADOR', ahora);
  if (!r.ok) throw errorDeTransicion(r.motivo, 'COTIZAR', estadoDe(s, ahora));
  try {
    await prisma.$transaction(async (tx) => {
      // Compara y cambia en un paso: si otra persona cotizó primero, no se pisa
      const { count } = await tx.solicitudEspacio.updateMany({
        where: { id, iglesiaId, estado: s.estado },
        data: { estado: r.estadoNuevo },
      });
      if (count !== 1) throw new AppError('CONFLICT', 'La solicitud ya cambió.', 409);
      await tx.cotizacion.create({
        data: {
          solicitudId: id,
          monto: new Prisma.Decimal(datos.monto),
          condiciones: datos.condiciones,
          emitidaEn: ahora,
          venceEn: fechaVencimiento(ahora),
        },
      });
    });
  } catch (error) {
    // El índice único parcial: dos cotizaciones sin respuesta a la vez no caben
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw AppError.conflicto('La solicitud ya tiene una cotización sin respuesta.');
    }
    if (error instanceof AppError) {
      throw AppError.conflicto('La solicitud cambió mientras la cotizabas. Ábrela de nuevo.');
    }
    throw error;
  }
  return obtenerSolicitud(iglesiaId, id, ahora);
}

// ═════════════════ Público (sin cuenta) ═════════════════

/** RF-71, RN-48: lo que la iglesia ofrece, sin precios. Solo tipos activos y disponibles. */
export async function tiposPublicos(iglesiaId: string) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { id: true, nombre: true, activa: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  // Una iglesia cerrada conserva su historia pero ya no aparece con servicios
  const tipos = iglesia.activa
    ? await prisma.tipoEspacio.findMany({
        where: { iglesiaId, activo: true, disponible: true },
        orderBy: { clase: 'asc' },
        select: { id: true, clase: true },
      })
    : [];
  return { iglesia: { id: iglesia.id, nombre: iglesia.nombre }, tipos };
}

async function siguienteFolio(anio: number): Promise<string> {
  const filas = await prisma.$queryRaw<
    { n: bigint }[]
  >`SELECT nextval('solicitudes_espacio_folio_seq') AS n`;
  return formatearFolio(anio, Number(filas[0]!.n));
}

function nuevaClave(): string {
  // 64 bytes alcanzan de sobra; si por mala suerte no, se piden otros
  for (;;) {
    const clave = claveDesdeBytes(randomBytes(64));
    if (clave) return clave;
  }
}

/** RF-72, RF-73, RN-49: crea la solicitud. Devuelve el folio y la clave UNA sola vez. */
export async function crearSolicitud(iglesiaId: string, datos: CrearSolicitud, ahora: Date) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { id: true, nombre: true, activa: true, zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  // Las rutas públicas no pasan por alcanceIglesia: la iglesia cerrada se revisa aquí
  if (!iglesia.activa) throw AppError.reglaNegocio('Esta iglesia ya no recibe solicitudes.');

  const tipo = await prisma.tipoEspacio.findFirst({
    where: { id: datos.tipoEspacioId, iglesiaId },
    select: { id: true, activo: true, disponible: true },
  });
  if (!tipo) throw AppError.noEncontrado('Esa iglesia no ofrece ese tipo de espacio.');
  if (!tipo.activo || !tipo.disponible) {
    throw AppError.reglaNegocio('Ese tipo de espacio no está disponible por ahora.');
  }

  const anio = Number(local(ahora, iglesia.zonaHoraria).fecha.slice(0, 4));
  const folio = await siguienteFolio(anio);
  const clave = nuevaClave();
  await prisma.solicitudEspacio.create({
    data: {
      folio,
      claveHash: hashToken(clave),
      iglesiaId,
      tipoEspacioId: tipo.id,
      contactoNombre: datos.contacto.nombre,
      contactoTelefono: datos.contacto.telefono ?? null,
      contactoCorreo: datos.contacto.correo ?? null,
      comentarios: datos.comentarios || null,
    },
  });
  return {
    folio,
    clave: mostrarClave(clave),
    estado: 'RECIBIDA' as const,
    iglesia: { nombre: iglesia.nombre },
    aviso: 'Guarda tu folio y tu clave: la clave no se vuelve a mostrar.',
  };
}

function claveCoincide(claveEscrita: string, claveHash: string): boolean {
  const a = Buffer.from(hashToken(normalizarClave(claveEscrita)), 'hex');
  const b = Buffer.from(claveHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Comprueba el folio y la clave. Un folio inexistente y una clave incorrecta se responden igual
 * (404). Las claves incorrectas se cuentan por folio y, al llegar al límite, lo bloquean un rato.
 */
async function verificarAcceso(folio: string, clave: string, ahora: Date) {
  const s = await prisma.solicitudEspacio.findUnique({
    where: { folio: normalizarFolio(folio) },
    select: SELECT_SOLICITUD,
  });
  if (!s) throw AppError.noEncontrado(MENSAJE_ACCESO);

  const bloqueo = evaluarBloqueo(s, ahora);
  if (bloqueo.bloqueado) {
    throw new AppError(
      'RATE_LIMITED',
      `Demasiados intentos con este folio. Vuelve a intentarlo en ${bloqueo.minutosRestantes} minuto(s).`,
      429,
    );
  }

  if (!claveCoincide(clave, s.claveHash)) {
    // Un bloqueo ya cumplido borra los intentos anteriores; luego se suma el nuevo de forma atómica
    await prisma.solicitudEspacio.updateMany({
      where: { id: s.id, bloqueadoHasta: { lte: ahora } },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    const { intentosFallidos } = await prisma.solicitudEspacio.update({
      where: { id: s.id },
      data: { intentosFallidos: { increment: 1 } },
      select: { intentosFallidos: true },
    });
    if (intentosFallidos >= SUPUESTOS_ACCESO.intentosAntesDeBloquear) {
      const { bloqueadoHasta } = trasIntentoFallido(
        { intentosFallidos: intentosFallidos - 1, bloqueadoHasta: null },
        ahora,
      );
      await prisma.solicitudEspacio.update({ where: { id: s.id }, data: { bloqueadoHasta } });
    }
    throw AppError.noEncontrado(MENSAJE_ACCESO);
  }

  if (s.intentosFallidos > 0 || s.bloqueadoHasta) {
    await prisma.solicitudEspacio.update({
      where: { id: s.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  }
  return s;
}

/** RF-74: estado y cotización de la solicitud, con folio y clave. */
export async function consultar(folio: string, clave: string, ahora: Date) {
  return aVistaPublica(await verificarAcceso(folio, clave, ahora), ahora);
}

/** RF-78, RF-80: la persona acepta o rechaza el precio, o cancela su solicitud. */
export async function responder(
  folio: string,
  clave: string,
  accion: 'ACEPTAR' | 'RECHAZAR' | 'CANCELAR',
  ahora: Date,
) {
  const s = await verificarAcceso(folio, clave, ahora);
  // Las rutas públicas no pasan por alcanceIglesia: la iglesia cerrada se revisa aquí
  if (!s.iglesia.activa) {
    throw AppError.reglaNegocio('Esta iglesia ya no recibe respuestas a sus solicitudes.');
  }
  // Si la cotización ya venció, se guarda ese estado primero y después se responde 422
  await exigirNoVencida(s, ahora);

  const r = evaluarTransicion(dominioDe(s), accion, 'SOLICITANTE', ahora);
  if (!r.ok) throw errorDeTransicion(r.motivo, accion, estadoDe(s, ahora));

  const abierta = cotizacionSinRespuesta(s);
  const aplicado = await prisma.$transaction(async (tx) => {
    const { count } = await tx.solicitudEspacio.updateMany({
      where: { id: s.id, estado: s.estado },
      data: { estado: r.estadoNuevo },
    });
    if (count !== 1) return false;
    // Al cancelar, la cotización conserva su historial tal como estaba
    if (accion !== 'CANCELAR' && abierta) {
      await tx.cotizacion.update({
        where: { id: abierta.id },
        data: { respuesta: accion === 'ACEPTAR' ? 'ACEPTADA' : 'RECHAZADA', respondidaEn: ahora },
      });
    }
    return true;
  });
  if (!aplicado)
    throw AppError.conflicto('Tu solicitud cambió mientras respondías. Consúltala de nuevo.');

  const actualizada = await prisma.solicitudEspacio.findUniqueOrThrow({
    where: { id: s.id },
    select: SELECT_SOLICITUD,
  });
  return aVistaPublica(actualizada, ahora);
}
