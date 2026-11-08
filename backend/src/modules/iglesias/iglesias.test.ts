// Versión mínima de iglesias: la Coordinación las lista y las crea; nadie más.
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
});

describe('GET /iglesias', () => {
  it('la Coordinación lista todas las iglesias por nombre', async () => {
    await crearIglesia({ nombre: 'Zacatecas' });
    await crearIglesia({ nombre: 'Acapulco' });
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).get('/iglesias');
    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { nombre: string }) => i.nombre)).toEqual([
      'Acapulco',
      'Zacatecas',
    ]);
    expect(res.body.meta.total).toBe(2);
  });

  it('busca por nombre sin distinguir mayúsculas', async () => {
    await crearIglesia({ nombre: 'Catedral de Mérida' });
    await crearIglesia({ nombre: 'Templo de Valladolid' });
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).get('/iglesias?q=mérida');
    expect(res.body.data).toHaveLength(1);
  });

  it('el personal de una iglesia no las lista (403) y sin sesión es 401', async () => {
    const iglesia = await crearIglesia();
    for (const rol of ['ADMIN_IGLESIA', 'TESORERO'] as const) {
      const { auth } = await loginComo(rol, { iglesiaId: iglesia.id });
      expect((await api(auth).get('/iglesias')).status).toBe(403);
    }
    expect((await request(app).get('/api/v1/iglesias')).status).toBe(401);
  });
});

describe('POST /iglesias', () => {
  it('la Coordinación crea una iglesia con la zona horaria por omisión', async () => {
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).post('/iglesias', {
      nombre: '  Santuario Nuevo ',
      tipo: 'SANTUARIO',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      nombre: 'Santuario Nuevo',
      tipo: 'SANTUARIO',
      zonaHoraria: 'America/Mexico_City',
      activa: true,
    });
    expect(await prisma.iglesia.count()).toBe(1);
  });

  it('acepta otra zona horaria válida', async () => {
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).post('/iglesias', {
      nombre: 'Frontera',
      tipo: 'CAPILLA',
      zonaHoraria: 'America/Tijuana',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.zonaHoraria).toBe('America/Tijuana');
  });

  it('valida nombre, tipo, zona y campos desconocidos (400)', async () => {
    const { auth } = await loginComo('COORDINACION');
    const malos = [
      { nombre: '   ', tipo: 'TEMPLO' },
      { nombre: 'X', tipo: 'CASA' },
      { nombre: 'X', tipo: 'TEMPLO', zonaHoraria: 'Marte/Olympus' },
      { nombre: 'X', tipo: 'TEMPLO', activa: false },
    ];
    for (const cuerpo of malos) {
      expect((await api(auth).post('/iglesias', cuerpo)).status).toBe(400);
    }
    expect(await prisma.iglesia.count()).toBe(0);
  });

  it('no repite el nombre de una iglesia existente (409)', async () => {
    await crearIglesia({ nombre: 'San Juan' });
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).post('/iglesias', { nombre: 'san juan', tipo: 'TEMPLO' });
    expect(res.status).toBe(409);
  });

  it('el administrador de una iglesia no crea iglesias (403) y sin sesión es 401', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    const cuerpo = { nombre: 'Otra', tipo: 'TEMPLO' };
    expect((await api(auth).post('/iglesias', cuerpo)).status).toBe(403);
    expect((await request(app).post('/api/v1/iglesias').send(cuerpo)).status).toBe(401);
  });
});
