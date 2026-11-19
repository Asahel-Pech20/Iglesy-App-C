import type { RolUsuario } from '../../config/permisos';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { enviarCorreo, plantillaEnlace } from '../../lib/mailer';
import { crearMeta, ordenar, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/seguridad';
import { crearTokenEnlace, revocarSesiones } from '../auth/auth.service';
import type { CrearUsuario, EditarUsuario, QueryUsuarios } from './usuarios.schemas';
import { SELECT_USUARIO } from './usuarios.select';

/** Quien hace la petición: la Coordinación (sin iglesia) ve a todos; el resto, solo a su iglesia. */
export interface Actor {
  id: string;
  rol: RolUsuario;
  iglesiaId: string | null;
}

const alcanceDe = (actor: Actor): Prisma.UsuarioWhereInput =>
  actor.rol === 'COORDINACION' ? {} : { iglesiaId: actor.iglesiaId };

const CORREO_DUPLICADO = 'El correo ya está registrado.';
const ULTIMO_ADMIN = 'Debe existir al menos un administrador activo en la iglesia.';
const HORAS_INVITACION = 48;

async function verificarEmailLibre(email: string, exceptoId?: string) {
  const otro = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (otro && otro.id !== exceptoId) {
    throw AppError.conflicto(CORREO_DUPLICADO, [{ campo: 'email', mensaje: CORREO_DUPLICADO }]);
  }
}

async function obtenerOFallar(id: string, actor: Actor) {
  const usuario = await prisma.usuario.findFirst({
    // Un usuario de otra iglesia no existe para quien no es de la Coordinación (RNF-10)
    where: { id, ...alcanceDe(actor) },
    select: { ...SELECT_USUARIO, passwordHash: true },
  });
  if (!usuario) throw AppError.noEncontrado('El usuario no existe.');
  return usuario;
}

/** Lanza 422 si el cambio dejaría a la iglesia sin administradores activos. */
async function protegerUltimoAdmin(usuario: {
  rol: RolUsuario;
  activo: boolean;
  iglesiaId: string | null;
}) {
  if (usuario.rol !== 'ADMIN_IGLESIA' || !usuario.activo) return;
  const activos = await prisma.usuario.count({
    where: { rol: 'ADMIN_IGLESIA', activo: true, iglesiaId: usuario.iglesiaId },
  });
  if (activos <= 1) throw AppError.reglaNegocio(ULTIMO_ADMIN);
}

async function enviarInvitacion(usuario: { id: string; nombre: string; email: string }) {
  const enlace = await crearTokenEnlace(usuario.id, HORAS_INVITACION);
  await enviarCorreo({
    para: usuario.email,
    asunto: 'Configura tu contraseña',
    ...plantillaEnlace({
      saludo: `Hola, ${usuario.nombre}:`,
      mensaje:
        'Se creó tu cuenta en el sistema de la iglesia. Configura tu contraseña para entrar.',
      textoBoton: 'Configurar contraseña',
      enlace,
      pie: `El enlace vence en ${HORAS_INVITACION} horas.`,
    }),
  });
}

export async function listar(query: QueryUsuarios, actor: Actor) {
  const { page, limit, skip, take } = paginar(query);
  const where: Prisma.UsuarioWhereInput = {
    ...alcanceDe(actor),
    ...(query.q && {
      OR: [
        { nombre: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ],
    }),
    ...(query.rol && { rol: query.rol }),
    ...(query.activo !== undefined && { activo: query.activo }),
  };
  const orderBy = ordenar(query.orden, ['nombre', 'email', 'rol', 'createdAt', 'ultimoAcceso'], {
    nombre: 'asc',
  });
  const [datos, total] = await Promise.all([
    prisma.usuario.findMany({ where, orderBy, skip, take, select: SELECT_USUARIO }),
    prisma.usuario.count({ where }),
  ]);
  return { datos, meta: crearMeta(total, page, limit) };
}

/** Para otros módulos (p. ej. coordinadores de un ministerio): el usuario o null, sin filtrar por iglesia. */
export function buscarPorId(id: string) {
  return prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO });
}

export async function obtener(id: string, actor: Actor) {
  const { passwordHash: _omitido, ...usuario } = await obtenerOFallar(id, actor);
  return usuario;
}

/** Usuarios activos para selectores (p. ej. coordinadores de ministerio). */
export function opciones(actor: Actor, rol?: RolUsuario) {
  return prisma.usuario.findMany({
    where: { activo: true, ...alcanceDe(actor), ...(rol && { rol }) },
    select: { id: true, nombre: true, rol: true },
    orderBy: { nombre: 'asc' },
  });
}

/**
 * Iglesia con la que se crea o se mueve un usuario. Solo la Coordinación crea usuarios de la
 * Coordinación (sin iglesia); el administrador de una iglesia solo crea en la suya (ADR-0004).
 */
async function resolverIglesia(
  rol: RolUsuario,
  pedida: string | undefined,
  actor: Actor,
  actual: string | null = null,
): Promise<string | null> {
  if (rol === 'COORDINACION') {
    if (actor.rol !== 'COORDINACION') {
      throw AppError.prohibido('Solo la Coordinación crea usuarios de la Coordinación.');
    }
    return null;
  }
  if (actor.iglesiaId && pedida && pedida !== actor.iglesiaId) {
    throw AppError.prohibido('Solo puedes administrar usuarios de tu iglesia.');
  }
  const iglesiaId = actor.iglesiaId ?? pedida ?? actual;
  if (!iglesiaId) {
    throw AppError.validacion('Indica la iglesia del usuario.', [
      { campo: 'iglesiaId', mensaje: 'Elige la iglesia.' },
    ]);
  }
  if (iglesiaId !== actual) {
    const existe = await prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { id: true },
    });
    if (!existe) {
      throw AppError.validacion('La iglesia no existe.', [
        { campo: 'iglesiaId', mensaje: 'La iglesia no existe.' },
      ]);
    }
  }
  return iglesiaId;
}

export async function crear(datos: CrearUsuario, actor: Actor) {
  const iglesiaId = await resolverIglesia(datos.rol, datos.iglesiaId, actor);
  await verificarEmailLibre(datos.email);
  const usuario = await prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      iglesiaId,
      passwordHash: datos.password ? await hashPassword(datos.password) : null,
    },
    select: SELECT_USUARIO,
  });
  if (!datos.password) await enviarInvitacion(usuario);
  return usuario;
}

export async function editar(id: string, datos: EditarUsuario, actor: Actor) {
  const actual = await obtenerOFallar(id, actor);
  if (datos.email) await verificarEmailLibre(datos.email, id);
  if (datos.iglesiaId !== undefined && actor.rol !== 'COORDINACION') {
    throw AppError.prohibido('Solo la Coordinación cambia a un usuario de iglesia.');
  }
  const rol = datos.rol ?? actual.rol;
  // Cambiar el rol puede cambiar la iglesia: la Coordinación no tiene; el resto sí
  const iglesiaId =
    datos.rol || datos.iglesiaId
      ? await resolverIglesia(rol, datos.iglesiaId, actor, actual.iglesiaId)
      : actual.iglesiaId;
  if (datos.rol && datos.rol !== 'ADMIN_IGLESIA') await protegerUltimoAdmin(actual);
  const { iglesiaId: _pedida, ...cambios } = datos;
  return prisma.usuario.update({
    where: { id },
    data: { ...cambios, iglesiaId },
    select: SELECT_USUARIO,
  });
}

export async function cambiarEstado(id: string, activo: boolean, actor: Actor) {
  const actual = await obtenerOFallar(id, actor);
  if (!activo) {
    if (id === actor.id) throw AppError.reglaNegocio('No puedes desactivar tu propia cuenta.');
    await protegerUltimoAdmin(actual);
  }
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({
      where: { id },
      data: { activo },
      select: SELECT_USUARIO,
    });
    // Usuario desactivado ⇒ se cierran todas sus sesiones (AGENTS.md §3)
    if (!activo) await revocarSesiones(id, tx);
    return usuario;
  });
}

export async function reenviarInvitacion(id: string, actor: Actor) {
  const usuario = await obtenerOFallar(id, actor);
  if (!usuario.activo) throw AppError.reglaNegocio('El usuario está desactivado.');
  if (usuario.passwordHash) {
    throw AppError.reglaNegocio('El usuario ya configuró su contraseña.');
  }
  await enviarInvitacion(usuario);
}
