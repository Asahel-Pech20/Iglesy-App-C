import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { loginComo } from '../../test/helpers';

let app: ReturnType<typeof crearApp>;
let admin: string;
beforeEach(async () => {
  app = crearApp();
  admin = (await loginComo('ADMIN_IGLESIA')).auth;
});
afterAll(() => rm(path.resolve(env.UPLOAD_DIR), { recursive: true, force: true }));

const CONFIG = {
  nombre: 'Iglesia Nueva Esperanza',
  direccion: 'Calle 60 #123',
  ciudad: 'Mérida',
  telefono: '',
  email: 'Contacto@Iglesia.mx',
  sitioWeb: 'https://iglesia.mx',
  moneda: 'MXN',
  zonaHoraria: 'America/Merida',
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('configuración (B1-15)', () => {
  it('GET es público y crea la fila por defecto si no existe', async () => {
    const res = await request(app).get('/api/v1/configuracion');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: 'Mi Iglesia', moneda: 'MXN', logoUrl: null });
    expect(res.body.data).not.toHaveProperty('id');
  });

  it('PUT (ADMIN_IGLESIA) guarda y normaliza', async () => {
    const res = await request(app)
      .put('/api/v1/configuracion')
      .set('Authorization', admin)
      .send(CONFIG);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      nombre: CONFIG.nombre,
      email: 'contacto@iglesia.mx',
      telefono: null,
    });
    expect((await request(app).get('/api/v1/configuracion')).body.data.nombre).toBe(CONFIG.nombre);
  });

  it('moneda y zona horaria fuera de la lista → 400', async () => {
    for (const cambio of [{ moneda: 'BTC' }, { zonaHoraria: 'Marte/Olympus' }]) {
      const res = await request(app)
        .put('/api/v1/configuracion')
        .set('Authorization', admin)
        .send({ ...CONFIG, ...cambio });
      expect(res.status).toBe(400);
    }
  });

  it('rol distinto de ADMIN_IGLESIA → 403 en PUT', async () => {
    const { auth } = await loginComo('PASTOR');
    expect(
      (await request(app).put('/api/v1/configuracion').set('Authorization', auth).send(CONFIG))
        .status,
    ).toBe(403);
    expect((await request(app).put('/api/v1/configuracion').send(CONFIG)).status).toBe(401);
  });
});

describe('logotipo (B1-16)', () => {
  const subir = (contenido: Buffer, nombre: string, tipo: string) =>
    request(app)
      .post('/api/v1/configuracion/logo')
      .set('Authorization', admin)
      .attach('logo', contenido, { filename: nombre, contentType: tipo });

  it('guarda con nombre UUID, devuelve URL absoluta servible y borra el anterior', async () => {
    const primero = await subir(PNG, '../../malicioso.png', 'image/png');
    expect(primero.status).toBe(200);
    const url = new URL(primero.body.data.logoUrl);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);

    const archivo = await request(app).get(url.pathname);
    expect(archivo.status).toBe(200);
    expect(archivo.headers['content-type']).toBe('image/png');
    expect(archivo.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const segundo = await subir(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      'logo.svg',
      'image/svg+xml',
    );
    expect(segundo.status).toBe(200);
    expect(existsSync(path.resolve(env.UPLOAD_DIR, path.basename(url.pathname)))).toBe(false);
  });

  it('archivo > 2 MB → 400', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await subir(grande, 'logo.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('El archivo supera 2 MB.');
  });

  it('tipo no permitido o contenido que no coincide → 400', async () => {
    expect((await subir(Buffer.from('%PDF-1.7'), 'logo.pdf', 'application/pdf')).status).toBe(400);
    expect((await subir(Buffer.from('no soy png'), 'logo.png', 'image/png')).status).toBe(400);
  });

  it('SVG con <script> → 400', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const res = await subir(svg, 'logo.svg', 'image/svg+xml');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('El SVG contiene código no permitido.');
  });

  it('sin archivo → 400; rol sin permiso → 403', async () => {
    expect(
      (await request(app).post('/api/v1/configuracion/logo').set('Authorization', admin)).status,
    ).toBe(400);
    const { auth } = await loginComo('SECRETARIO');
    const res = await request(app)
      .post('/api/v1/configuracion/logo')
      .set('Authorization', auth)
      .attach('logo', PNG, 'logo.png');
    expect(res.status).toBe(403);
  });
});

describe('horarios (B1-17)', () => {
  const crear = (body: object) =>
    request(app).post('/api/v1/configuracion/horarios').set('Authorization', admin).send(body);

  it('lista pública ordenada por día y hora', async () => {
    await crear({ nombre: 'Estudio', diaSemana: 3, horaInicio: '19:00' });
    await crear({
      nombre: 'Culto',
      diaSemana: 0,
      horaInicio: '10:00',
      horaFin: '12:00',
      lugar: 'Templo',
    });
    await crear({ nombre: 'Escuela dominical', diaSemana: 0, horaInicio: '08:30' });
    const res = await request(app).get('/api/v1/configuracion/horarios');
    expect(res.status).toBe(200);
    expect(res.body.data.map((h: { nombre: string }) => h.nombre)).toEqual([
      'Escuela dominical',
      'Culto',
      'Estudio',
    ]);
    expect(res.body.data[1]).toMatchObject({ horaFin: '12:00', lugar: 'Templo', activo: true });
  });

  it('valida formato HH:mm y horaFin > horaInicio', async () => {
    expect((await crear({ nombre: 'X', diaSemana: 1, horaInicio: '25:00' })).status).toBe(400);
    expect((await crear({ nombre: 'X', diaSemana: 7, horaInicio: '10:00' })).status).toBe(400);
    const res = await crear({ nombre: 'X', diaSemana: 1, horaInicio: '18:00', horaFin: '17:00' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      expect.objectContaining({
        campo: 'horaFin',
        mensaje: 'La hora de fin debe ser posterior a la de inicio.',
      }),
    ]);
  });

  it('PATCH valida contra el registro completo; DELETE elimina', async () => {
    const { body } = await crear({
      nombre: 'Ensayo',
      diaSemana: 5,
      horaInicio: '18:00',
      horaFin: '20:00',
    });
    const id = body.data.id;
    const invalido = await request(app)
      .patch(`/api/v1/configuracion/horarios/${id}`)
      .set('Authorization', admin)
      .send({ horaInicio: '21:00' });
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.details[0].campo).toBe('horaFin');

    const editado = await request(app)
      .patch(`/api/v1/configuracion/horarios/${id}`)
      .set('Authorization', admin)
      .send({ activo: false });
    expect(editado.body.data.activo).toBe(false);

    expect(
      (
        await request(app)
          .delete(`/api/v1/configuracion/horarios/${id}`)
          .set('Authorization', admin)
      ).status,
    ).toBe(204);
    expect(await prisma.horarioReunion.count()).toBe(0);
    expect(
      (
        await request(app)
          .delete(`/api/v1/configuracion/horarios/${id}`)
          .set('Authorization', admin)
      ).status,
    ).toBe(404);
  });

  it('rol sin permiso → 403', async () => {
    const { auth } = await loginComo('COORDINADOR');
    const res = await request(app)
      .post('/api/v1/configuracion/horarios')
      .set('Authorization', auth)
      .send({ nombre: 'X', diaSemana: 1, horaInicio: '10:00' });
    expect(res.status).toBe(403);
  });
});
