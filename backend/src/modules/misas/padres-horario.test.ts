// E3-06 (padres en varias iglesias) y E3-07 (horario semanal sin choques de un padre).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../test/bd';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();

const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  put: (url: string, cuerpo?: object) =>
    request(app).put(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  delete: (url: string) => request(app).delete(`/api/v1${url}`).set('Authorization', auth),
});

async function escenario() {
  const parroquia = await crearIglesia({ nombre: 'Parroquia de San Miguel' });
  const capilla = await crearIglesia({ nombre: 'Capilla de la Merced', tipo: 'CAPILLA' });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: parroquia.id });
  const adminCapilla = await loginComo('ADMIN_IGLESIA', { iglesiaId: capilla.id });
  const tesorero = await loginComo('TESORERO', { iglesiaId: parroquia.id });
  const coordinacion = await loginComo('COORDINACION');
  return { parroquia, capilla, admin, adminCapilla, tesorero, coordinacion };
}

/** Padre asociado a las iglesias indicadas (directo en la BD). */
async function padreEn(nombre: string, ...iglesias: string[]) {
  return prisma.padre.create({
    data: {
      nombre,
      titulo: 'Pbro.',
      iglesias: { create: iglesias.map((iglesiaId) => ({ iglesiaId })) },
    },
  });
}

const misa = (padreId: string, extra: Record<string, unknown> = {}) => ({
  diaSemana: 0,
  hora: '10:00',
  tipo: 'DOMINICAL',
  padreId,
  ...extra,
});

describe('padres de una iglesia (E3-06: RF-40, RF-41, RN-28)', () => {
  it('el administrador registra un padre con título y queda solo en su iglesia', async () => {
    const { parroquia, capilla, admin, adminCapilla } = await escenario();
    const creado = await api(admin.auth).post(`/iglesias/${parroquia.id}/padres`, {
      nombre: 'Andrés Ruiz',
      titulo: 'Pbro.',
    });
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ nombre: 'Andrés Ruiz', titulo: 'Pbro.' });

    const propios = await api(admin.auth).get(`/iglesias/${parroquia.id}/padres`);
    expect(propios.body.data.map((p: { nombre: string }) => p.nombre)).toEqual(['Andrés Ruiz']);
    const ajenos = await api(adminCapilla.auth).get(`/iglesias/${capilla.id}/padres`);
    expect(ajenos.body.data).toEqual([]);
  });

  it('un padre que ya existe no se duplica: se asocia a la otra iglesia (409 → PUT)', async () => {
    const { parroquia, capilla, admin, adminCapilla } = await escenario();
    const padre = (
      await api(admin.auth).post(`/iglesias/${parroquia.id}/padres`, { nombre: 'Andrés Ruiz' })
    ).body.data;

    const repetido = await api(adminCapilla.auth).post(`/iglesias/${capilla.id}/padres`, {
      nombre: 'andrés ruiz',
    });
    expect(repetido.status).toBe(409);
    expect(JSON.stringify(repetido.body.error.details)).toContain(padre.id);

    const url = `/iglesias/${capilla.id}/padres/${padre.id}`;
    expect((await api(adminCapilla.auth).put(url)).status).toBe(200);
    expect((await api(adminCapilla.auth).put(url)).status).toBe(200); // repetirlo no cambia nada
    expect(await prisma.padreIglesia.count({ where: { padreId: padre.id } })).toBe(2);
  });

  it('asociar un padre inexistente o dado de baja → 404', async () => {
    const { parroquia, admin } = await escenario();
    const baja = await prisma.padre.create({ data: { nombre: 'Julián Mena', activo: false } });
    const url = (id: string) => `/iglesias/${parroquia.id}/padres/${id}`;
    expect((await api(admin.auth).put(url(baja.id))).status).toBe(404);
    expect((await api(admin.auth).put(url(crypto.randomUUID()))).status).toBe(404);
    expect((await api(admin.auth).put(url('no-es-uuid'))).status).toBe(400);
  });

  it('desasociar lo quita de la lista sin borrar al padre; si tiene misas en el horario → 422', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/padres/${padre.id}`;

    const h = await api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id));
    expect((await api(admin.auth).delete(url)).status).toBe(422);

    await api(admin.auth).delete(`/iglesias/${parroquia.id}/horario-misas/${h.body.data.id}`);
    expect((await api(admin.auth).delete(url)).status).toBe(204);
    expect((await api(admin.auth).get(`/iglesias/${parroquia.id}/padres`)).body.data).toEqual([]);
    expect(await prisma.padre.count({ where: { id: padre.id } })).toBe(1);
    expect((await api(admin.auth).delete(url)).status).toBe(404);
  });

  it('el tesorero y otra iglesia no asocian padres (403)', async () => {
    const { parroquia, tesorero, adminCapilla } = await escenario();
    const padre = await padreEn('Andrés Ruiz');
    const url = `/iglesias/${parroquia.id}/padres/${padre.id}`;
    expect((await api(tesorero.auth).put(url)).status).toBe(403);
    expect((await api(adminCapilla.auth).put(url)).status).toBe(403);
    expect((await api(adminCapilla.auth).delete(url)).status).toBe(403);
  });
});

describe('padres de todo el país (E3-06, supuesto P-19)', () => {
  it('la Coordinación los crea, los busca con sus iglesias y corrige sus datos', async () => {
    const { parroquia, capilla, coordinacion } = await escenario();
    const creado = await api(coordinacion.auth).post('/padres', { nombre: 'Tomás Lara' });
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ titulo: null, activo: true, iglesias: [] });
    await padreEn('Andrés Ruiz', parroquia.id, capilla.id);

    const busqueda = await api(coordinacion.auth).get('/padres?q=ruiz');
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.meta.total).toBe(1);
    expect(busqueda.body.data[0].iglesias.map((i: { nombre: string }) => i.nombre)).toEqual([
      'Capilla de la Merced',
      'Parroquia de San Miguel',
    ]);

    const editado = await api(coordinacion.auth).patch(`/padres/${creado.body.data.id}`, {
      titulo: 'Fr.',
    });
    expect(editado.status).toBe(200);
    expect(editado.body.data.titulo).toBe('Fr.');
  });

  it('no da de baja a un padre con misas en algún horario (422)', async () => {
    const { parroquia, admin, coordinacion } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    await api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id));
    const r = await api(coordinacion.auth).patch(`/padres/${padre.id}`, { activo: false });
    expect(r.status).toBe(422);
  });

  it('valida los datos (400) y no repite nombres (409)', async () => {
    const { coordinacion } = await escenario();
    await padreEn('Andrés Ruiz');
    expect((await api(coordinacion.auth).post('/padres', { nombre: '' })).status).toBe(400);
    expect((await api(coordinacion.auth).post('/padres', { nombre: 'X', extra: 1 })).status).toBe(
      400,
    );
    expect((await api(coordinacion.auth).patch(`/padres/${crypto.randomUUID()}`, {})).status).toBe(
      400,
    );
    expect((await api(coordinacion.auth).post('/padres', { nombre: 'ANDRÉS RUIZ' })).status).toBe(
      409,
    );
  });

  it('las iglesias buscan padres pero no los editan; el tesorero ni busca (403)', async () => {
    const { admin, tesorero } = await escenario();
    const padre = await padreEn('Andrés Ruiz');
    expect((await api(admin.auth).get('/padres')).status).toBe(200);
    expect((await api(admin.auth).post('/padres', { nombre: 'Luis' })).status).toBe(403);
    expect((await api(admin.auth).patch(`/padres/${padre.id}`, { titulo: 'Fr.' })).status).toBe(
      403,
    );
    expect((await api(tesorero.auth).get('/padres')).status).toBe(403);
    expect((await request(app).get('/api/v1/padres')).status).toBe(401);
  });
});

describe('horario semanal de misas (E3-07: RF-42, RF-43, RF-46, RN-20, RN-21, RN-27)', () => {
  it('programa misas con día, hora local, tipo, idioma y padre; se listan por día y hora', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;

    const dominical = await api(admin.auth).post(url, misa(padre.id, { hora: '12:00' }));
    expect(dominical.status).toBe(201);
    expect(dominical.body.data).toMatchObject({
      diaSemana: 0,
      hora: '12:00',
      tipo: 'DOMINICAL',
      idioma: 'ESPANOL',
      duracionMin: null,
      padre: { id: padre.id, nombre: 'Andrés Ruiz', titulo: 'Pbro.' },
    });
    await api(admin.auth).post(url, misa(padre.id, { hora: '08:00', idioma: 'NAHUATL' }));
    await api(admin.auth).post(
      url,
      misa(padre.id, { diaSemana: 3, hora: '19:00', tipo: 'DIARIA' }),
    );

    const lista = await api(admin.auth).get(url);
    expect(lista.status).toBe(200);
    expect(
      lista.body.data.map((m: { diaSemana: number; hora: string }) => `${m.diaSemana} ${m.hora}`),
    ).toEqual(['0 08:00', '0 12:00', '3 19:00']);
    expect(lista.body.data[0].idioma).toBe('NAHUATL');
  });

  it('valida día, hora, tipo, idioma, duración y campos desconocidos (400)', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    for (const extra of [
      { diaSemana: 7 },
      { diaSemana: 1.5 },
      { hora: '7:00' },
      { hora: '24:00' },
      { tipo: 'SEMANAL' },
      { idioma: 'INGLES' },
      { duracionMin: 0 },
      { duracionMin: 721 },
      { lugar: 'Atrio' },
    ]) {
      expect((await api(admin.auth).post(url, misa(padre.id, extra))).status).toBe(400);
    }
    expect(await prisma.horarioMisa.count()).toBe(0);
  });

  it('un padre que no es de la iglesia → 422; uno inexistente → 400', async () => {
    const { parroquia, capilla, admin } = await escenario();
    const deLaCapilla = await padreEn('Tomás Lara', capilla.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    expect((await api(admin.auth).post(url, misa(deLaCapilla.id))).status).toBe(422);
    expect((await api(admin.auth).post(url, misa(crypto.randomUUID()))).status).toBe(400);
  });

  it('quitar una misa del horario es baja lógica y libera la hora', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    const h = await api(admin.auth).post(url, misa(padre.id));
    expect((await api(admin.auth).delete(`${url}/${h.body.data.id}`)).status).toBe(204);
    expect((await api(admin.auth).get(url)).body.data).toEqual([]);
    expect(await prisma.horarioMisa.count({ where: { id: h.body.data.id } })).toBe(1);
    expect((await api(admin.auth).post(url, misa(padre.id))).status).toBe(201);
    expect((await api(admin.auth).delete(`${url}/${h.body.data.id}`)).status).toBe(404);
  });
});

describe('choques de un padre (E3-07: RF-45, RN-26)', () => {
  it('rechaza dos misas a la misma hora en la misma iglesia y dice con cuál choca', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    await api(admin.auth).post(url, misa(padre.id));
    const choque = await api(admin.auth).post(url, misa(padre.id, { tipo: 'ESPECIAL' }));
    expect(choque.status).toBe(409);
    expect(choque.body.error.message).toContain('domingo a las 10:00 en Parroquia de San Miguel');
    expect(await prisma.horarioMisa.count()).toBe(1);
  });

  it('rechaza la misma hora en templos distintos (el caso que ya les pasó)', async () => {
    const { parroquia, capilla, admin, adminCapilla } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id, capilla.id);
    await api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id));
    const choque = await api(adminCapilla.auth).post(
      `/iglesias/${capilla.id}/horario-misas`,
      misa(padre.id),
    );
    expect(choque.status).toBe(409);
    expect(choque.body.error.message).toContain('Parroquia de San Miguel');
  });

  it('cuenta la duración: 10:00 de 90 min choca con 11:00; de 60 min, no', async () => {
    const { parroquia, admin } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    const larga = await api(admin.auth).post(url, misa(padre.id, { duracionMin: 90 }));
    expect((await api(admin.auth).post(url, misa(padre.id, { hora: '11:00' }))).status).toBe(409);
    await api(admin.auth).patch(`${url}/${larga.body.data.id}`, { duracionMin: null });
    expect((await api(admin.auth).post(url, misa(padre.id, { hora: '11:00' }))).status).toBe(201);
  });

  it('compara el momento real entre zonas horarias (Cancún 11:00 = CDMX 10:00)', async () => {
    const { parroquia, admin } = await escenario();
    const cancun = await crearIglesia({
      nombre: 'Parroquia de Cancún',
      zonaHoraria: 'America/Cancun',
    });
    const adminCancun = await loginComo('ADMIN_IGLESIA', { iglesiaId: cancun.id });
    const padre = await padreEn('Andrés Ruiz', parroquia.id, cancun.id);
    await api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id));
    const url = `/iglesias/${cancun.id}/horario-misas`;
    expect((await api(adminCancun.auth).post(url, misa(padre.id, { hora: '11:00' }))).status).toBe(
      409,
    );
    // 10:00 en Cancún termina justo cuando empieza la de la CDMX: seguidas, no chocan
    expect((await api(adminCancun.auth).post(url, misa(padre.id))).status).toBe(201);
  });

  it('al cambiar una misa se vuelven a revisar los choques; mover la propia no choca consigo', async () => {
    const { parroquia, admin } = await escenario();
    const titular = await padreEn('Andrés Ruiz', parroquia.id);
    const vicario = await padreEn('Tomás Lara', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    const diez = await api(admin.auth).post(url, misa(titular.id));
    const doce = await api(admin.auth).post(url, misa(vicario.id, { hora: '12:00' }));

    expect(
      (await api(admin.auth).patch(`${url}/${diez.body.data.id}`, { hora: '10:30' })).status,
    ).toBe(200);
    const aOtroPadre = await api(admin.auth).patch(`${url}/${doce.body.data.id}`, {
      padreId: titular.id,
      hora: '11:00',
    });
    expect(aOtroPadre.status).toBe(409);
    const sinCambio = await prisma.horarioMisa.findUniqueOrThrow({
      where: { id: doce.body.data.id },
    });
    expect(sinCambio).toMatchObject({ padreId: vicario.id, hora: '12:00' });
  });

  it('dos altas simultáneas del mismo padre a la misma hora: solo una se guarda', async () => {
    const { parroquia, capilla, admin, adminCapilla } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id, capilla.id);
    const [a, b] = await Promise.all([
      api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id)),
      api(adminCapilla.auth).post(`/iglesias/${capilla.id}/horario-misas`, misa(padre.id)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.horarioMisa.count({ where: { padreId: padre.id } })).toBe(1);
  });
});

describe('acceso al horario (RN-32, RNF-10)', () => {
  it('el tesorero lo consulta pero no lo programa; otra iglesia recibe 403', async () => {
    const { parroquia, tesorero, adminCapilla } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    expect((await api(tesorero.auth).get(url)).status).toBe(200);
    expect((await api(tesorero.auth).post(url, misa(padre.id))).status).toBe(403);
    expect((await api(adminCapilla.auth).get(url)).status).toBe(403);
    expect((await api(adminCapilla.auth).post(url, misa(padre.id))).status).toBe(403);
  });

  it('la Coordinación consulta el horario de cualquier iglesia pero no lo cambia', async () => {
    const { parroquia, coordinacion } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const url = `/iglesias/${parroquia.id}/horario-misas`;
    expect((await api(coordinacion.auth).get(url)).status).toBe(200);
    expect((await api(coordinacion.auth).post(url, misa(padre.id))).status).toBe(403);
  });

  it('una misa de otra iglesia no se cambia desde la propia (404); cerrada no acepta cambios (422)', async () => {
    const { parroquia, capilla, admin, adminCapilla } = await escenario();
    const padre = await padreEn('Andrés Ruiz', parroquia.id);
    const h = await api(admin.auth).post(`/iglesias/${parroquia.id}/horario-misas`, misa(padre.id));
    const ajena = `/iglesias/${capilla.id}/horario-misas/${h.body.data.id}`;
    expect((await api(adminCapilla.auth).patch(ajena, { hora: '11:00' })).status).toBe(404);
    expect((await api(adminCapilla.auth).delete(ajena)).status).toBe(404);

    await prisma.iglesia.update({
      where: { id: parroquia.id },
      data: { activa: false, fechaCierre: new Date('2026-11-01'), motivoCierre: 'Sismo' },
    });
    expect(
      (
        await api(admin.auth).post(
          `/iglesias/${parroquia.id}/horario-misas`,
          misa(padre.id, { hora: '18:00' }),
        )
      ).status,
    ).toBe(422);
  });

  it('sin sesión → 401', async () => {
    const { parroquia } = await escenario();
    expect((await request(app).get(`/api/v1/iglesias/${parroquia.id}/horario-misas`)).status).toBe(
      401,
    );
  });
});
