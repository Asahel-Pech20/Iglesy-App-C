import { randomUUID } from 'node:crypto';
import type { RolUsuario } from '../config/permisos';
import type { TipoIglesia } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';
import { firmarAccessToken, hashPassword } from '../lib/seguridad';

export const PASSWORD_PRUEBA = 'Prueba123';

/** Crea una iglesia en la BD de pruebas. */
export async function crearIglesia(
  datos: { nombre?: string; tipo?: TipoIglesia; zonaHoraria?: string; activa?: boolean } = {},
) {
  return prisma.iglesia.create({
    data: {
      nombre: datos.nombre ?? `Iglesia ${randomUUID().slice(0, 8)}`,
      tipo: datos.tipo ?? 'PARROQUIA',
      zonaHoraria: datos.zonaHoraria ?? 'America/Mexico_City',
      activa: datos.activa ?? true,
    },
  });
}

/**
 * Crea un usuario en la BD de pruebas. El personal de iglesia queda en la iglesia indicada en
 * `iglesiaId`, o en la primera de la prueba (se crea si no hay) si no se indica; la Coordinación (nacional) no tiene iglesia.
 */
export async function crearUsuario(
  rol: RolUsuario,
  datos: {
    nombre?: string;
    email?: string;
    activo?: boolean;
    password?: string | null;
    iglesiaId?: string | null;
  } = {},
) {
  const password = datos.password === undefined ? PASSWORD_PRUEBA : datos.password;
  const iglesiaId =
    datos.iglesiaId !== undefined
      ? datos.iglesiaId
      : rol === 'COORDINACION'
        ? null
        : (
            (await prisma.iglesia.findFirst({ orderBy: { createdAt: 'asc' } })) ??
            (await crearIglesia())
          ).id;
  return prisma.usuario.create({
    data: {
      rol,
      iglesiaId,
      nombre: datos.nombre ?? `Usuario ${rol}`,
      email: datos.email ?? `${rol.toLowerCase()}-${randomUUID().slice(0, 8)}@prueba.local`,
      activo: datos.activo ?? true,
      passwordHash: password === null ? null : await hashPassword(password),
    },
  });
}

/**
 * Crea un usuario con ese rol y devuelve su cabecera Authorization lista para Supertest.
 * @example const { auth } = await loginComo('ADMIN_IGLESIA'); request(app).get('/api/v1/usuarios').set('Authorization', auth)
 */
export async function loginComo(rol: RolUsuario, datos?: Parameters<typeof crearUsuario>[1]) {
  const usuario = await crearUsuario(rol, datos);
  const token = firmarAccessToken({ sub: usuario.id, rol: usuario.rol });
  return { usuario, token, auth: `Bearer ${token}` };
}
