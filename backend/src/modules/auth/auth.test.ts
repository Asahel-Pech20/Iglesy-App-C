import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { env } from '../../config/env';
import { correosEnviados } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { crearUsuario, loginComo, PASSWORD_PRUEBA } from '../../test/helpers';

let app: ReturnType<typeof crearApp>;
beforeEach(() => {
  app = crearApp();
});

const cookieDe = (res: request.Response) =>
  ([res.headers['set-cookie']].flat() as string[]).find((c) => c.startsWith('refreshToken='))!;

async function entrar(email: string, password = PASSWORD_PRUEBA) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

describe('POST /auth/login (B1-09)', () => {
  it('devuelve access token, usuario y permisos, y fija la cookie de refresh', async () => {
    const usuario = await crearUsuario('TESORERO', { email: 'tesorero@prueba.local' });
    const res = await entrar('TESORERO@prueba.local');
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.usuario).toMatchObject({ id: usuario.id, rol: 'TESORERO' });
    expect(res.body.data.usuario).not.toHaveProperty('passwordHash');
    expect(res.body.data.permisos).toContain('donaciones:crear');
    const cookie = cookieDe(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    const actualizado = await prisma.usuario.findUnique({ where: { id: usuario.id } });
    expect(actualizado?.ultimoAcceso).not.toBeNull();
  });

  it('credenciales inválidas → 401 con mensaje genérico', async () => {
    await crearUsuario('ADMIN_IGLESIA', { email: 'a@prueba.local' });
    for (const res of [
      await entrar('a@prueba.local', 'mala1234'),
      await entrar('no@prueba.local'),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Correo o contraseña incorrectos.',
      });
    }
  });

  it('usuario inactivo → 401 con el mismo mensaje', async () => {
    await crearUsuario('PASTOR', { email: 'p@prueba.local', activo: false });
    const res = await entrar('p@prueba.local');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Correo o contraseña incorrectos.');
  });

  it('valida el cuerpo → 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('6.º intento en un minuto → 429', async () => {
    for (let i = 0; i < 5; i++) expect((await entrar('x@prueba.local')).status).toBe(401);
    const res = await entrar('x@prueba.local');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('middleware autenticar (B1-09)', () => {
  it('sin token → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('token expirado → 401 TOKEN_EXPIRED', async () => {
    const { usuario } = await loginComo('ADMIN_IGLESIA');
    const expirado = jwt.sign({ sub: usuario.id, rol: 'ADMIN_IGLESIA' }, env.JWT_ACCESS_SECRET, {
      expiresIn: -1,
    });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expirado}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('usuario desactivado después de emitir el token → 401', async () => {
    const { usuario, auth } = await loginComo('ADMIN_IGLESIA');
    await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: false } });
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', auth)).status).toBe(401);
  });
});

describe('refresh, logout y /auth/me (B1-10)', () => {
  it('/auth/me nunca incluye passwordHash', async () => {
    const { auth } = await loginComo('SECRETARIO');
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(res.body.data.permisos).toContain('miembros:crear');
  });

  it('/auth/me trae la iglesia del personal y la Coordinación no tiene (null)', async () => {
    const tesorero = await loginComo('TESORERO');
    const propio = await request(app).get('/api/v1/auth/me').set('Authorization', tesorero.auth);
    expect(propio.body.data.usuario.iglesiaId).toBe(tesorero.usuario.iglesiaId);
    expect(propio.body.data.usuario.iglesiaId).toEqual(expect.any(String));
    const coordinacion = await loginComo('COORDINACION');
    const nacional = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', coordinacion.auth);
    expect(nacional.body.data.usuario.iglesiaId).toBeNull();
  });

  it('refresh rota el token: el anterior deja de servir', async () => {
    await crearUsuario('ADMIN_IGLESIA', { email: 'r@prueba.local' });
    const original = cookieDe(await entrar('r@prueba.local'));

    const primero = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    expect(primero.status).toBe(200);
    expect(primero.body.data.accessToken).toEqual(expect.any(String));
    const nuevo = cookieDe(primero);
    expect(nuevo).not.toBe(original);

    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', nuevo)).status).toBe(200);
  });

  it('refresh reutilizado → 401 y todas las sesiones del usuario cerradas', async () => {
    const usuario = await crearUsuario('ADMIN_IGLESIA', { email: 'robo@prueba.local' });
    const sesionA = cookieDe(await entrar('robo@prueba.local'));
    const sesionB = cookieDe(await entrar('robo@prueba.local'));

    await request(app).post('/api/v1/auth/refresh').set('Cookie', sesionA);
    const reuso = await request(app).post('/api/v1/auth/refresh').set('Cookie', sesionA);
    expect(reuso.status).toBe(401);

    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', sesionB)).status).toBe(
      401,
    );
    const vivos = await prisma.refreshToken.count({
      where: { usuarioId: usuario.id, revocadoEn: null },
    });
    expect(vivos).toBe(0);
  });

  it('refresh sin cookie → 401', async () => {
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('logout revoca el refresh y limpia la cookie', async () => {
    await crearUsuario('ADMIN_IGLESIA', { email: 'l@prueba.local' });
    const login = await entrar('l@prueba.local');
    const cookie = cookieDe(login);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(cookieDe(res)).toMatch(/refreshToken=;/);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(
      401,
    );
  });

  it('logout funciona solo con la cookie (access token vencido o ausente)', async () => {
    await crearUsuario('ADMIN_IGLESIA', { email: 'l2@prueba.local' });
    const cookie = cookieDe(await entrar('l2@prueba.local'));
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer token-vencido')
      .set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(
      401,
    );
    // Sin cookie tampoco falla: no hay nada que revocar
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(204);
  });
});

describe('recuperación de contraseña (B1-12)', () => {
  const tokenDelCorreo = () => /token=([0-9a-f]{64})/.exec(correosEnviados.at(-1)!.texto)![1]!;

  it('forgot-password responde 204 aunque el correo no exista, y no envía nada', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nadie@prueba.local' });
    expect(res.status).toBe(204);
    expect(correosEnviados).toHaveLength(0);
  });

  it('flujo completo: correo con enlace, nueva contraseña, token de un solo uso', async () => {
    const usuario = await crearUsuario('PASTOR', { email: 'olvido@prueba.local' });
    const sesion = cookieDe(await entrar('olvido@prueba.local'));

    expect(
      (
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'olvido@prueba.local' })
      ).status,
    ).toBe(204);
    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0]!.texto).toContain(`${env.FRONTEND_URL}/restablecer?token=`);
    const token = tokenDelCorreo();
    // En BD solo se guarda el hash
    const guardado = await prisma.passwordResetToken.findFirst({
      where: { usuarioId: usuario.id },
    });
    expect(guardado?.tokenHash).not.toBe(token);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'Nueva1234' });
    expect(res.status).toBe(204);
    expect((await entrar('olvido@prueba.local', 'Nueva1234')).status).toBe(200);
    // Las sesiones anteriores se revocan
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', sesion)).status).toBe(
      401,
    );

    const reuso = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'Otra12345' });
    expect(reuso.status).toBe(400);
    expect(reuso.body.error.details).toEqual([
      { campo: 'token', mensaje: 'El enlace no es válido o ya expiró.' },
    ]);
  });

  it('token expirado → 400', async () => {
    await crearUsuario('PASTOR', { email: 'exp@prueba.local' });
    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'exp@prueba.local' });
    await prisma.passwordResetToken.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: tokenDelCorreo(), password: 'Nueva1234' });
    expect(res.status).toBe(400);
  });

  it('contraseña débil → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'x', password: 'corta' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /auth/me/password', () => {
  it('cambia la contraseña con la actual correcta', async () => {
    const { usuario, auth } = await loginComo('ADMIN_IGLESIA', { email: 'c@prueba.local' });
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', auth)
      .send({ passwordActual: PASSWORD_PRUEBA, passwordNueva: 'Nueva1234' });
    expect(res.status).toBe(204);
    expect((await entrar(usuario.email, 'Nueva1234')).status).toBe(200);
  });

  it('contraseña actual incorrecta → 400 con el error en el campo', async () => {
    const { auth } = await loginComo('ADMIN_IGLESIA');
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', auth)
      .send({ passwordActual: 'mala1234', passwordNueva: 'Nueva1234' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { campo: 'passwordActual', mensaje: 'La contraseña actual es incorrecta.' },
    ]);
  });

  it('sin sesión → 401', async () => {
    const res = await request(app).patch('/api/v1/auth/me/password').send({});
    expect(res.status).toBe(401);
  });
});
