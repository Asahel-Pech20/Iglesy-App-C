import { env } from '../../config/env';
import { permisosDe } from '../../config/permisos';
import { AppError } from '../../lib/appError';
import { enviarCorreo, plantillaEnlace } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import {
  duracionMs,
  firmarAccessToken,
  generarTokenAleatorio,
  hashPassword,
  hashToken,
  verificarPassword,
} from '../../lib/seguridad';
import { SELECT_USUARIO } from '../usuarios/usuarios.tipos';

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';
const ENLACE_INVALIDO = 'El enlace no es válido o ya expiró.';
// Hash señuelo: se compara aunque el correo no exista, para no revelar qué cuentas existen por el tiempo de respuesta
let hashSenuelo: Promise<string> | null = null;

type Cliente = Pick<typeof prisma, 'refreshToken' | 'passwordResetToken' | 'usuario'>;

/**
 * Usuario, permisos e iglesia del personal (E1-02). `iglesia` es null solo en la Coordinación.
 * Se lee por la relación de Usuario: el frontend la muestra sin pedir permisos de iglesias.
 */
export async function obtenerSesion(usuarioId: string) {
  const encontrado = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { ...SELECT_USUARIO, iglesia: { select: { id: true, nombre: true, activa: true } } },
  });
  if (!encontrado?.activo) throw AppError.noAutenticado();
  const { iglesia, ...usuario } = encontrado;
  return { usuario, permisos: permisosDe(usuario.rol), iglesia };
}

/** Crea un refresh token nuevo; en BD solo queda su hash. */
async function emitirRefresh(usuarioId: string, db: Cliente = prisma) {
  const token = generarTokenAleatorio();
  await db.refreshToken.create({
    data: {
      usuarioId,
      tokenHash: hashToken(token),
      expiraEn: new Date(Date.now() + duracionMs(env.JWT_REFRESH_TTL)),
    },
  });
  return token;
}

export async function revocarSesiones(usuarioId: string, db: Cliente = prisma) {
  await db.refreshToken.updateMany({
    where: { usuarioId, revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}

export async function login(email: string, password: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, rol: true, activo: true, passwordHash: true },
  });
  const valida = await verificarPassword(
    password,
    usuario?.passwordHash ?? (await (hashSenuelo ??= hashPassword(generarTokenAleatorio()))),
  );
  // Mismo mensaje para correo inexistente, contraseña incorrecta o usuario inactivo
  if (!usuario || !valida || !usuario.activo) throw AppError.noAutenticado(CREDENCIALES_INVALIDAS);

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
  const refreshToken = await emitirRefresh(usuario.id);
  const sesion = await obtenerSesion(usuario.id);
  return {
    accessToken: firmarAccessToken({ sub: usuario.id, rol: usuario.rol }),
    refreshToken,
    sesion,
  };
}

/** Rota el refresh token. Si llega uno ya revocado (posible robo), cierra todas las sesiones. */
export async function refrescar(token: string | undefined) {
  if (!token) throw AppError.noAutenticado();
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, rol: true, activo: true } } },
  });
  if (!registro) throw AppError.noAutenticado();
  if (registro.revocadoEn) {
    await revocarSesiones(registro.usuarioId);
    throw AppError.noAutenticado('La sesión ya no es válida. Inicia sesión de nuevo.');
  }
  if (registro.expiraEn < new Date() || !registro.usuario.activo) throw AppError.noAutenticado();

  const nuevo = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: registro.id }, data: { revocadoEn: new Date() } });
    return emitirRefresh(registro.usuarioId, tx);
  });
  return {
    accessToken: firmarAccessToken({ sub: registro.usuario.id, rol: registro.usuario.rol }),
    refreshToken: nuevo,
  };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}

/**
 * Token de un solo uso para fijar contraseña (recuperación 1 h, invitación 48 h).
 * Invalida los enlaces anteriores que no se hayan usado.
 */
export async function crearTokenEnlace(usuarioId: string, horas: number) {
  const token = generarTokenAleatorio();
  // Transacción interactiva: las escrituras van una tras otra por la misma conexión
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { usuarioId, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        usuarioId,
        tokenHash: hashToken(token),
        expiraEn: new Date(Date.now() + horas * 3_600_000),
      },
    });
  });
  return `${env.FRONTEND_URL}/restablecer?token=${token}`;
}

/** Responde igual exista o no el correo (no revela qué cuentas existen). */
export async function solicitarRecuperacion(email: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nombre: true, email: true, activo: true },
  });
  if (!usuario?.activo) return;
  const enlace = await crearTokenEnlace(usuario.id, 1);
  await enviarCorreo({
    para: usuario.email,
    asunto: 'Restablece tu contraseña',
    ...plantillaEnlace({
      saludo: `Hola, ${usuario.nombre}:`,
      mensaje: 'Recibimos una solicitud para restablecer tu contraseña.',
      textoBoton: 'Restablecer contraseña',
      enlace,
      pie: 'El enlace vence en 1 hora. Si no lo solicitaste, ignora este correo.',
    }),
  });
}

export async function restablecer(token: string, password: string) {
  const registro = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { activo: true } } },
  });
  if (!registro || registro.usadoEn || registro.expiraEn < new Date() || !registro.usuario.activo) {
    throw AppError.validacion(ENLACE_INVALIDO, [{ campo: 'token', mensaje: ENLACE_INVALIDO }]);
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: registro.id },
      data: { usadoEn: new Date() },
    });
    await tx.usuario.update({ where: { id: registro.usuarioId }, data: { passwordHash } });
    await revocarSesiones(registro.usuarioId, tx);
  });
}

export async function cambiarPassword(usuarioId: string, actual: string, nueva: string) {
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { passwordHash: true },
  });
  if (!(await verificarPassword(actual, usuario.passwordHash))) {
    throw AppError.validacion('Los datos enviados no son válidos.', [
      { campo: 'passwordActual', mensaje: 'La contraseña actual es incorrecta.' },
    ]);
  }
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { passwordHash: await hashPassword(nueva) },
  });
}
