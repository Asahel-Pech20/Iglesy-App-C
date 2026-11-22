import { randomUUID } from 'node:crypto';
import type { RolUsuario } from '../config/permisos';
import type { TipoIglesia } from '../generated/prisma/client';
import { iglesiaDePrueba, prisma } from './bd';
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

/**
 * E1-06: otra iglesia con un miembro, un ministerio, un coordinador y un evento, para probar que la
 * gestión interna no se mezcla entre iglesias. La iglesia de pruebas sigue siendo la primera, así
 * que `loginComo` (personal) cae en ella y no en esta.
 */
export async function deOtraIglesia() {
  await iglesiaDePrueba();
  const { id: iglesiaId } = await crearIglesia({ nombre: `Otra ${randomUUID().slice(0, 8)}` });
  const coordinador = await crearUsuario('COORDINADOR', { iglesiaId });
  const miembro = await prisma.miembro.create({
    data: {
      nombre: 'Ajeno',
      apellidos: 'De Otra',
      fechaIngreso: new Date('2025-01-01'),
      iglesiaId,
    },
  });
  const ministerio = await prisma.ministerio.create({ data: { nombre: 'Jóvenes', iglesiaId } });
  const evento = await prisma.evento.create({
    data: {
      titulo: 'Evento ajeno',
      tipo: 'RELIGIOSO',
      categoria: 'CULTO',
      lugar: 'Otro templo',
      fechaInicio: new Date(Date.now() - 3_600_000),
      creadoPorId: coordinador.id,
      iglesiaId,
    },
  });
  return { iglesiaId, coordinador, miembro, ministerio, evento };
}
