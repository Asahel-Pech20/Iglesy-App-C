import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { correosEnviados } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { crearUsuario, loginComo } from '../../test/helpers';

let app: ReturnType<typeof crearApp>;
let admin: Awaited<ReturnType<typeof loginComo>>;
beforeEach(async () => {
  app = crearApp();
  admin = await loginComo('ADMIN_IGLESIA', {
    nombre: 'Admin Principal',
    email: 'admin@prueba.local',
  });
});

const api = () => ({
  get: (url: string, auth = admin.auth) =>
    request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, body?: object, auth = admin.auth) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(body),
  patch: (url: string, body: object, auth = admin.auth) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(body),
});

describe('GET /usuarios', () => {
  it('lista paginada con filtros y sin passwordHash', async () => {
    await crearUsuario('TESORERO', { nombre: 'Jorge Canul' });
    await crearUsuario('PASTOR', { nombre: 'Daniel Ruiz', activo: false });

    const todos = await api().get('/usuarios?limit=2');
    expect(todos.status).toBe(200);
    expect(todos.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(JSON.stringify(todos.body)).not.toContain('passwordHash');

    const filtrado = await api().get('/usuarios?q=canul&activo=true');
    expect(filtrado.body.data.map((u: { nombre: string }) => u.nombre)).toEqual(['Jorge Canul']);
    const inactivos = await api().get('/usuarios?activo=false&rol=PASTOR');
    expect(inactivos.body.data).toHaveLength(1);
  });

  it('query inválida → 400', async () => {
    expect((await api().get('/usuarios?rol=JEFE')).status).toBe(400);
  });

  it('rol sin permiso → 403; sin sesión → 401', async () => {
    const pastor = await loginComo('PASTOR');
    expect((await api().get('/usuarios', pastor.auth)).status).toBe(403);
    expect((await request(app).get('/api/v1/usuarios')).status).toBe(401);
  });
});

describe('POST /usuarios (B1-13, B1-14)', () => {
  it('crea sin contraseña y envía la invitación; el usuario fija su contraseña y entra', async () => {
    const res = await api().post('/usuarios', {
      nombre: ' Rosa Pech ',
      email: 'Rosa@Prueba.local',
      rol: 'SECRETARIO',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      nombre: 'Rosa Pech',
      email: 'rosa@prueba.local',
      activo: true,
    });

    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0]!.asunto).toBe('Configura tu contraseña');
    const token = /token=([0-9a-f]{64})/.exec(correosEnviados[0]!.texto)![1];
    const invitacion = await prisma.passwordResetToken.findFirstOrThrow();
    // Vence en ~48 h
    expect(invitacion.expiraEn.getTime() - Date.now()).toBeGreaterThan(47 * 3_600_000);

    // Sin contraseña no puede entrar
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'rosa@prueba.local', password: 'Nueva1234' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, password: 'Nueva1234' })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'rosa@prueba.local', password: 'Nueva1234' })
      ).status,
    ).toBe(200);
  });

  it('email duplicado → 409 con el error en el campo', async () => {
    const res = await api().post('/usuarios', {
      nombre: 'Otro',
      email: 'ADMIN@prueba.local',
      rol: 'PASTOR',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([
      { campo: 'email', mensaje: 'El correo ya está registrado.' },
    ]);
  });

  it('campos desconocidos o inválidos → 400', async () => {
    const res = await api().post('/usuarios', {
      nombre: 'X',
      email: 'x@prueba.local',
      rol: 'ADMIN_IGLESIA',
      esJefe: true,
    });
    expect(res.status).toBe(400);
  });

  it('rol sin permiso → 403', async () => {
    const secretario = await loginComo('SECRETARIO');
    expect(
      (
        await api().post(
          '/usuarios',
          { nombre: 'X', email: 'x@p.local', rol: 'ADMIN_IGLESIA' },
          secretario.auth,
        )
      ).status,
    ).toBe(403);
  });
});

describe('PATCH /usuarios/:id y /estado (B1-13)', () => {
  it('edita nombre y rol', async () => {
    const otro = await crearUsuario('PASTOR');
    const res = await api().patch(`/usuarios/${otro.id}`, {
      nombre: 'Nuevo nombre',
      rol: 'SECRETARIO',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: 'Nuevo nombre', rol: 'SECRETARIO' });
  });

  it('id inexistente → 404; id mal formado → 400', async () => {
    expect((await api().get('/usuarios/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await api().get('/usuarios/abc')).status).toBe(400);
  });

  it('no se puede quitar el rol ADMIN_IGLESIA al último administrador activo → 422', async () => {
    const res = await api().patch(`/usuarios/${admin.usuario.id}`, { rol: 'PASTOR' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      'Debe existir al menos un administrador activo en la iglesia.',
    );
  });

  it('no se puede desactivar al último administrador activo → 422', async () => {
    const segundo = await loginComo('ADMIN_IGLESIA');
    // Con dos admins activos, uno puede desactivar al otro
    expect(
      (await api().patch(`/usuarios/${admin.usuario.id}/estado`, { activo: false }, segundo.auth))
        .status,
    ).toBe(200);
    // Un admin inactivo no cuenta: `segundo` es ahora el último
    const res = await api().patch(
      `/usuarios/${segundo.usuario.id}`,
      { rol: 'PASTOR' },
      segundo.auth,
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
  });

  it('un ADMIN_IGLESIA no puede desactivarse a sí mismo → 422', async () => {
    await crearUsuario('ADMIN_IGLESIA');
    const res = await api().patch(`/usuarios/${admin.usuario.id}/estado`, { activo: false });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('No puedes desactivar tu propia cuenta.');
  });

  it('desactivar revoca sus refresh tokens', async () => {
    const otro = await crearUsuario('TESORERO', { email: 'teso@prueba.local' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'teso@prueba.local', password: 'Prueba123' });
    const cookie = [login.headers['set-cookie']].flat()[0] as string;

    expect((await api().patch(`/usuarios/${otro.id}/estado`, { activo: false })).status).toBe(200);
    expect(
      await prisma.refreshToken.count({ where: { usuarioId: otro.id, revocadoEn: null } }),
    ).toBe(0);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(
      401,
    );
  });
});

describe('GET /usuarios/opciones', () => {
  it('ADMIN_IGLESIA y PASTOR obtienen solo activos con { id, nombre, rol }', async () => {
    await crearUsuario('COORDINADOR', { nombre: 'Coordinadora Activa' });
    await crearUsuario('COORDINADOR', { nombre: 'Coordinador Inactivo', activo: false });
    const pastor = await loginComo('PASTOR');
    const res = await api().get('/usuarios/opciones?rol=COORDINADOR', pastor.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: expect.any(String), nombre: 'Coordinadora Activa', rol: 'COORDINADOR' },
    ]);
  });

  it('SECRETARIO → 403', async () => {
    const secretario = await loginComo('SECRETARIO');
    expect((await api().get('/usuarios/opciones', secretario.auth)).status).toBe(403);
  });
});

describe('POST /usuarios/:id/reenviar-invitacion (B1-14)', () => {
  it('reenvía e invalida el enlace anterior', async () => {
    const creado = await api().post('/usuarios', {
      nombre: 'Inv',
      email: 'inv@prueba.local',
      rol: 'PASTOR',
    });
    const primero = /token=([0-9a-f]{64})/.exec(correosEnviados[0]!.texto)![1];
    expect((await api().post(`/usuarios/${creado.body.data.id}/reenviar-invitacion`)).status).toBe(
      204,
    );
    expect(correosEnviados).toHaveLength(2);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token: primero, password: 'Nueva1234' })
      ).status,
    ).toBe(400);
  });

  it('usuario que ya tiene contraseña → 422', async () => {
    const otro = await crearUsuario('PASTOR');
    expect((await api().post(`/usuarios/${otro.id}/reenviar-invitacion`)).status).toBe(422);
  });
});
