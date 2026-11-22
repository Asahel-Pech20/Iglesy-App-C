// Versión mínima de misas: padres y misas celebradas (lo que el diezmo necesita).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const DIA = 24 * 60 * 60 * 1000;

const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

async function escenario() {
  const iglesia = await crearIglesia();
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
  return { iglesia, admin, tesorero };
}

describe('padres', () => {
  it('el administrador registra un padre y se lista por nombre', async () => {
    const { iglesia, admin } = await escenario();
    const url = `/iglesias/${iglesia.id}/padres`;
    const creado = await api(admin.auth).post(url, { nombre: '  Luis Pérez  ' });
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ nombre: 'Luis Pérez' });
    await api(admin.auth).post(url, { nombre: 'Ana Padre' });
    const lista = await api(admin.auth).get(url);
    expect(lista.body.data.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Ana Padre',
      'Luis Pérez',
    ]);
  });

  it('valida el nombre (400) y rechaza campos desconocidos', async () => {
    const { iglesia, admin } = await escenario();
    const url = `/iglesias/${iglesia.id}/padres`;
    expect((await api(admin.auth).post(url, { nombre: '   ' })).status).toBe(400);
    expect((await api(admin.auth).post(url, { nombre: 'X', activo: false })).status).toBe(400);
  });

  it('el tesorero consulta pero no registra padres (403)', async () => {
    const { iglesia, tesorero } = await escenario();
    const url = `/iglesias/${iglesia.id}/padres`;
    expect((await api(tesorero.auth).get(url)).status).toBe(200);
    expect((await api(tesorero.auth).post(url, { nombre: 'Luis' })).status).toBe(403);
  });

  it('otra iglesia y la Coordinación reciben 403; sin sesión, 401', async () => {
    const { iglesia } = await escenario();
    const url = `/iglesias/${iglesia.id}/padres`;
    const ajeno = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    const coordinacion = await loginComo('COORDINACION');
    expect((await api(ajeno.auth).get(url)).status).toBe(403);
    expect((await api(coordinacion.auth).get(url)).status).toBe(403);
    expect((await request(app).get(`/api/v1${url}`)).status).toBe(401);
  });
});

describe('misas celebradas', () => {
  const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();

  async function conPadre() {
    const e = await escenario();
    const padre = await prisma.padre.create({ data: { nombre: 'Luis Pérez' } });
    return { ...e, padre, url: `/iglesias/${e.iglesia.id}/misas-celebradas` };
  }

  it('el administrador registra una misa ya celebrada y aparece sin diezmo', async () => {
    const { admin, padre, url } = await conPadre();
    const creada = await api(admin.auth).post(url, { inicio: hace(1), padreId: padre.id });
    expect(creada.status).toBe(201);
    expect(creada.body.data).toMatchObject({ padre: { id: padre.id }, diezmo: null });
    const lista = await api(admin.auth).get(url);
    expect(lista.body.data).toHaveLength(1);
    expect(lista.body.meta.total).toBe(1);
  });

  it('muestra el diezmo capturado de cada misa', async () => {
    const { iglesia, admin, tesorero, padre, url } = await conPadre();
    const misa = await prisma.misaCelebrada.create({
      data: { iglesiaId: iglesia.id, inicio: new Date(hace(1)), padreId: padre.id },
    });
    await prisma.diezmo.create({
      data: {
        misaId: misa.id,
        iglesiaId: iglesia.id,
        monto: '1250.50',
        capturadoPorId: tesorero.usuario.id,
      },
    });
    const lista = await api(admin.auth).get(url);
    expect(lista.body.data[0].diezmo).toMatchObject({ monto: '1250.50' });
  });

  it('no se registra una misa que todavía no ocurre (422)', async () => {
    const { admin, padre, url } = await conPadre();
    const futura = new Date(Date.now() + 2 * DIA).toISOString();
    const res = await api(admin.auth).post(url, { inicio: futura, padreId: padre.id });
    expect(res.status).toBe(422);
    expect(await prisma.misaCelebrada.count()).toBe(0);
  });

  it('dos misas a la misma hora en la misma iglesia → 409', async () => {
    const { admin, padre, url } = await conPadre();
    const inicio = hace(2);
    await api(admin.auth).post(url, { inicio, padreId: padre.id });
    const otra = await api(admin.auth).post(url, { inicio, padreId: padre.id });
    expect(otra.status).toBe(409);
  });

  it('valida la fecha, el padre y los campos desconocidos', async () => {
    const { admin, padre, url } = await conPadre();
    expect((await api(admin.auth).post(url, { inicio: 'ayer', padreId: padre.id })).status).toBe(
      400,
    );
    expect((await api(admin.auth).post(url, { inicio: hace(1), padreId: 'x' })).status).toBe(400);
    expect(
      (await api(admin.auth).post(url, { inicio: hace(1), padreId: padre.id, iglesiaId: 'x' }))
        .status,
    ).toBe(400);
    const inexistente = '5f4b8c3e-6a5d-4a53-9a1e-0c1d2e3f4a5b';
    expect(
      (await api(admin.auth).post(url, { inicio: hace(1), padreId: inexistente })).status,
    ).toBe(404);
  });

  it('el tesorero consulta pero no registra misas (403)', async () => {
    const { tesorero, padre, url } = await conPadre();
    expect((await api(tesorero.auth).get(url)).status).toBe(200);
    expect(
      (await api(tesorero.auth).post(url, { inicio: hace(1), padreId: padre.id })).status,
    ).toBe(403);
  });

  it('el personal de otra iglesia no registra ni ve las misas (403)', async () => {
    const { padre, url } = await conPadre();
    const ajeno = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    expect((await api(ajeno.auth).get(url)).status).toBe(403);
    expect((await api(ajeno.auth).post(url, { inicio: hace(1), padreId: padre.id })).status).toBe(
      403,
    );
  });

  it('filtra por periodo en la hora local de la iglesia y rechaza periodos inválidos', async () => {
    const { iglesia, admin, padre, url } = await conPadre();
    // Domingo 8 de nov, 18:00 en la Ciudad de México = lunes 9, 00:00 UTC
    await prisma.misaCelebrada.create({
      data: {
        iglesiaId: iglesia.id,
        inicio: new Date('2026-11-09T00:00:00.000Z'),
        padreId: padre.id,
      },
    });
    const domingo = await api(admin.auth).get(`${url}?desde=2026-11-08&hasta=2026-11-08`);
    expect(domingo.body.meta.total).toBe(1);
    // Se muestra con la fecha y la hora locales de la iglesia, no las de UTC
    expect(domingo.body.data[0]).toMatchObject({ fechaLocal: '2026-11-08', horaLocal: '18:00' });
    const lunes = await api(admin.auth).get(`${url}?desde=2026-11-09&hasta=2026-11-09`);
    expect(lunes.body.meta.total).toBe(0);
    expect((await api(admin.auth).get(`${url}?desde=2026-11-09&hasta=2026-11-01`)).status).toBe(
      400,
    );
  });
});
