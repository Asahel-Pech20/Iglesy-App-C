// Alcance por iglesia de los usuarios (ADR-0004, RNF-10): cada administrador gestiona solo a su
// personal y solo la Coordinación crea usuarios de la Coordinación.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

async function dosIglesias() {
  const [a, b] = [await crearIglesia(), await crearIglesia()];
  const adminA = await loginComo('ADMIN_IGLESIA', { iglesiaId: a.id });
  const adminB = await loginComo('ADMIN_IGLESIA', { iglesiaId: b.id });
  const tesoreroB = await loginComo('TESORERO', { iglesiaId: b.id });
  const coordinacion = await loginComo('COORDINACION');
  return { a, b, adminA, adminB, tesoreroB, coordinacion };
}

describe('listar y consultar usuarios', () => {
  it('el administrador ve solo a su personal; la Coordinación ve a todos', async () => {
    const { adminA, adminB, tesoreroB, coordinacion } = await dosIglesias();
    const propios = await api(adminA.auth).get('/usuarios?limit=100');
    expect(propios.body.data.map((u: { id: string }) => u.id)).toEqual([adminA.usuario.id]);
    const todos = await api(coordinacion.auth).get('/usuarios?limit=100');
    expect(todos.body.meta.total).toBe(4);
    expect(todos.body.data.map((u: { id: string }) => u.id)).toEqual(
      expect.arrayContaining([adminB.usuario.id, tesoreroB.usuario.id]),
    );
  });

  it('un usuario de otra iglesia no existe para el administrador (404)', async () => {
    const { adminA, tesoreroB } = await dosIglesias();
    const url = `/usuarios/${tesoreroB.usuario.id}`;
    expect((await api(adminA.auth).get(url)).status).toBe(404);
    expect((await api(adminA.auth).patch(url, { nombre: 'Otro' })).status).toBe(404);
    expect((await api(adminA.auth).patch(`${url}/estado`, { activo: false })).status).toBe(404);
    expect(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: tesoreroB.usuario.id } })).activo,
    ).toBe(true);
  });

  it('las opciones de usuarios son solo las de la propia iglesia', async () => {
    const { adminA, tesoreroB } = await dosIglesias();
    const res = await api(adminA.auth).get('/usuarios/opciones');
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(adminA.usuario.id);
    expect(ids).not.toContain(tesoreroB.usuario.id);
  });

  it('el JSON de un usuario incluye su iglesia y nunca su contraseña', async () => {
    const { adminA, a } = await dosIglesias();
    const res = await api(adminA.auth).get(`/usuarios/${adminA.usuario.id}`);
    expect(res.body.data.iglesiaId).toBe(a.id);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });
});

describe('crear usuarios', () => {
  const nuevo = (rol: string, extra: object = {}) => ({
    nombre: 'Persona Nueva',
    email: `nuevo-${rol.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@prueba.local`,
    rol,
    password: 'Segura123',
    ...extra,
  });

  it('el administrador crea personal en su propia iglesia', async () => {
    const { adminA, a } = await dosIglesias();
    const res = await api(adminA.auth).post('/usuarios', nuevo('TESORERO'));
    expect(res.status).toBe(201);
    expect(res.body.data.iglesiaId).toBe(a.id);
  });

  it('el administrador no crea personal en otra iglesia (403)', async () => {
    const { adminA, b } = await dosIglesias();
    const res = await api(adminA.auth).post('/usuarios', nuevo('TESORERO', { iglesiaId: b.id }));
    expect(res.status).toBe(403);
  });

  it('el administrador no crea usuarios de la Coordinación (403): no hay escalada de privilegios', async () => {
    const { adminA } = await dosIglesias();
    const res = await api(adminA.auth).post('/usuarios', nuevo('COORDINACION'));
    expect(res.status).toBe(403);
    // Solo existe la de la Coordinación que creó el escenario
    expect(await prisma.usuario.count({ where: { rol: 'COORDINACION' } })).toBe(1);
  });

  it('el administrador no se asciende ni asciende a otro a la Coordinación (403)', async () => {
    const { adminA } = await dosIglesias();
    const res = await api(adminA.auth).patch(`/usuarios/${adminA.usuario.id}`, {
      rol: 'COORDINACION',
    });
    expect(res.status).toBe(403);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: adminA.usuario.id } })).rol).toBe(
      'ADMIN_IGLESIA',
    );
  });

  it('el administrador no puede mover a un usuario de iglesia (403)', async () => {
    const { adminA, b } = await dosIglesias();
    const propio = await api(adminA.auth).post('/usuarios', nuevo('SECRETARIO'));
    const res = await api(adminA.auth).patch(`/usuarios/${propio.body.data.id}`, {
      iglesiaId: b.id,
    });
    expect(res.status).toBe(403);
  });

  it('la Coordinación crea un administrador indicando la iglesia', async () => {
    const { coordinacion, b } = await dosIglesias();
    const res = await api(coordinacion.auth).post(
      '/usuarios',
      nuevo('ADMIN_IGLESIA', { iglesiaId: b.id }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rol: 'ADMIN_IGLESIA', iglesiaId: b.id });
  });

  it('la Coordinación debe indicar una iglesia que exista para el personal de iglesia (400)', async () => {
    const { coordinacion } = await dosIglesias();
    const sin = await api(coordinacion.auth).post('/usuarios', nuevo('TESORERO'));
    expect(sin.status).toBe(400);
    expect(sin.body.error.details).toEqual([expect.objectContaining({ campo: 'iglesiaId' })]);
    const falsa = await api(coordinacion.auth).post(
      '/usuarios',
      nuevo('TESORERO', { iglesiaId: '5f4b8c3e-6a5d-4a53-9a1e-0c1d2e3f4a5b' }),
    );
    expect(falsa.status).toBe(400);
  });

  it('la Coordinación crea usuarios de la Coordinación sin iglesia', async () => {
    const { coordinacion } = await dosIglesias();
    const res = await api(coordinacion.auth).post('/usuarios', nuevo('COORDINACION'));
    expect(res.status).toBe(201);
    expect(res.body.data.iglesiaId).toBeNull();
  });

  it('la Coordinación pasa a un usuario a otra iglesia', async () => {
    const { coordinacion, tesoreroB, a } = await dosIglesias();
    const res = await api(coordinacion.auth).patch(`/usuarios/${tesoreroB.usuario.id}`, {
      iglesiaId: a.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.iglesiaId).toBe(a.id);
  });

  it('al ascender a alguien a la Coordinación se le quita la iglesia', async () => {
    const { coordinacion, tesoreroB } = await dosIglesias();
    const res = await api(coordinacion.auth).patch(`/usuarios/${tesoreroB.usuario.id}`, {
      rol: 'COORDINACION',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rol: 'COORDINACION', iglesiaId: null });
  });
});

describe('último administrador de cada iglesia', () => {
  it('desactivar al único administrador de una iglesia es 422 aunque otras iglesias tengan', async () => {
    const { coordinacion, adminB } = await dosIglesias();
    const res = await api(coordinacion.auth).patch(`/usuarios/${adminB.usuario.id}/estado`, {
      activo: false,
    });
    expect(res.status).toBe(422);
    expect(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: adminB.usuario.id } })).activo,
    ).toBe(true);
  });
});
