// E3-11 a E3-14: servicios y pláticas de una iglesia, y su consulta pública.
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
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  delete: (url: string) => request(app).delete(`/api/v1${url}`).set('Authorization', auth),
});

async function escenario() {
  const iglesia = await crearIglesia({ nombre: 'Parroquia de San Miguel' });
  const otra = await crearIglesia({ nombre: 'Capilla de la Merced', tipo: 'CAPILLA' });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const adminOtra = await loginComo('ADMIN_IGLESIA', { iglesiaId: otra.id });
  return {
    iglesia,
    otra,
    admin,
    adminOtra,
    servicios: `/iglesias/${iglesia.id}/servicios`,
    platicas: `/iglesias/${iglesia.id}/platicas`,
  };
}

const bautizo = {
  nombre: 'Bautizo',
  formaCosto: 'MONTO',
  monto: '350.50',
  requisitos: 'Acta de nacimiento y plática prebautismal.',
  duracionMin: 60,
  requiereCita: true,
  horarios: [
    { diaSemana: 6, hora: '12:00' },
    { diaSemana: 6, hora: '10:00' },
  ],
};

const prebautismal = {
  tipo: 'PREBAUTISMAL',
  sesiones: 2,
  costo: '0',
  cupo: 30,
  lugar: 'Salón parroquial',
  imparte: 'Matrimonio Pérez',
  horarios: [{ diaSemana: 3, hora: '19:00' }],
};

describe('servicios de la iglesia (E3-11: RF-30–RF-34, RN-22, RN-23)', () => {
  it('registra un servicio con costo, requisitos, duración, cita y horarios', async () => {
    const { admin, servicios } = await escenario();
    const r = await api(admin.auth).post(servicios, bautizo);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      nombre: 'Bautizo',
      formaCosto: 'MONTO',
      monto: '350.50',
      duracionMin: 60,
      requiereCita: true,
      horarios: [
        { diaSemana: 6, hora: '10:00' },
        { diaSemana: 6, hora: '12:00' },
      ],
    });
    const lista = await api(admin.auth).get(servicios);
    expect(lista.body.data.map((s: { nombre: string }) => s.nombre)).toEqual(['Bautizo']);
  });

  it('gratuito o con donativo voluntario, con o sin monto sugerido (RN-22, P-11)', async () => {
    const { admin, servicios } = await escenario();
    const confirmacion = await api(admin.auth).post(servicios, {
      nombre: 'Confirmación',
      formaCosto: 'GRATUITO',
    });
    expect(confirmacion.status).toBe(201);
    expect(confirmacion.body.data).toMatchObject({
      monto: null,
      requiereCita: false,
      horarios: [],
    });
    const comunion = await api(admin.auth).post(servicios, {
      nombre: 'Primera comunión',
      formaCosto: 'DONATIVO',
    });
    expect(comunion.body.data.monto).toBeNull();
    const xv = await api(admin.auth).post(servicios, {
      nombre: 'Misa de XV años',
      formaCosto: 'DONATIVO',
      monto: '500',
    });
    expect(xv.body.data.monto).toBe('500.00');
  });

  it('valida el costo y los datos (400)', async () => {
    const { admin, servicios } = await escenario();
    for (const cuerpo of [
      { nombre: 'A', formaCosto: 'MONTO' },
      { nombre: 'A', formaCosto: 'MONTO', monto: '0' },
      { nombre: 'A', formaCosto: 'MONTO', monto: '12.345' },
      { nombre: 'A', formaCosto: 'MONTO', monto: '-5' },
      { nombre: 'A', formaCosto: 'GRATUITO', monto: '10' },
      { nombre: 'A', formaCosto: 'DONATIVO', monto: '0.00' },
      { nombre: '  ', formaCosto: 'GRATUITO' },
      { nombre: 'A', formaCosto: 'GRATIS' },
      { nombre: 'A', formaCosto: 'GRATUITO', duracionMin: 0 },
      { nombre: 'A', formaCosto: 'GRATUITO', horarios: [{ diaSemana: 7, hora: '10:00' }] },
      {
        nombre: 'A',
        formaCosto: 'GRATUITO',
        horarios: [
          { diaSemana: 1, hora: '10:00' },
          { diaSemana: 1, hora: '10:00' },
        ],
      },
      { nombre: 'A', formaCosto: 'GRATUITO', precio: 5 },
    ]) {
      expect((await api(admin.auth).post(servicios, cuerpo)).status).toBe(400);
    }
    expect(await prisma.servicio.count()).toBe(0);
  });

  it('no repite el nombre en la misma iglesia; en otra sí, y tras quitarlo también (409)', async () => {
    const { otra, admin, adminOtra, servicios } = await escenario();
    const creado = await api(admin.auth).post(servicios, bautizo);
    const repetido = await api(admin.auth).post(servicios, { ...bautizo, nombre: 'BAUTIZO' });
    expect(repetido.status).toBe(409);
    expect((await api(adminOtra.auth).post(`/iglesias/${otra.id}/servicios`, bautizo)).status).toBe(
      201,
    );
    expect((await api(admin.auth).delete(`${servicios}/${creado.body.data.id}`)).status).toBe(204);
    expect((await api(admin.auth).post(servicios, bautizo)).status).toBe(201);
  });

  it('se modifica; los horarios se reemplazan y el costo se revisa con los datos combinados (RF-34)', async () => {
    const { admin, servicios } = await escenario();
    const id = (await api(admin.auth).post(servicios, bautizo)).body.data.id;
    const url = `${servicios}/${id}`;

    const gratuito = await api(admin.auth).patch(url, {
      formaCosto: 'GRATUITO',
      horarios: [{ diaSemana: 0, hora: '13:00' }],
    });
    expect(gratuito.status).toBe(200);
    expect(gratuito.body.data).toMatchObject({
      monto: null,
      horarios: [{ diaSemana: 0, hora: '13:00' }],
    });
    // De gratuito a con costo sin decir el monto → 400
    expect((await api(admin.auth).patch(url, { formaCosto: 'MONTO' })).status).toBe(400);
    const conCosto = await api(admin.auth).patch(url, { formaCosto: 'MONTO', monto: '400' });
    expect(conCosto.body.data.monto).toBe('400.00');
    expect((await api(admin.auth).patch(url, {})).status).toBe(400);
  });

  it('quitar es baja lógica: deja de listarse pero no se borra', async () => {
    const { admin, servicios } = await escenario();
    const id = (await api(admin.auth).post(servicios, bautizo)).body.data.id;
    expect((await api(admin.auth).delete(`${servicios}/${id}`)).status).toBe(204);
    expect((await api(admin.auth).get(servicios)).body.data).toEqual([]);
    expect(await prisma.servicio.count({ where: { id } })).toBe(1);
    expect((await api(admin.auth).delete(`${servicios}/${id}`)).status).toBe(404);
  });

  it('la BD también rechaza un costo incoherente', async () => {
    const { iglesia } = await escenario();
    await expect(
      prisma.servicio.create({
        data: { iglesiaId: iglesia.id, nombre: 'X', formaCosto: 'GRATUITO', monto: '10' },
      }),
    ).rejects.toThrow(/servicios_costo_consistente/);
  });
});

describe('pláticas de la iglesia (E3-13: RF-36, RF-37, RN-24, RN-25)', () => {
  it('registra tipo, días y hora, sesiones, costo exacto, cupo, lugar y quién la da', async () => {
    const { admin, platicas } = await escenario();
    const r = await api(admin.auth).post(platicas, prebautismal);
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      tipo: 'PREBAUTISMAL',
      sesiones: 2,
      costo: '0.00',
      cupo: 30,
      lugar: 'Salón parroquial',
      imparte: 'Matrimonio Pérez',
      padre: null,
      horarios: [{ diaSemana: 3, hora: '19:00' }],
    });
  });

  it('valida tipo, sesiones, cupo, costo, lugar y que tenga al menos un horario (400)', async () => {
    const { admin, platicas } = await escenario();
    for (const cambio of [
      { tipo: 'CATEQUESIS' },
      { sesiones: 0 },
      { cupo: 0 },
      { costo: '10.999' },
      { lugar: '' },
      { imparte: '   ' },
      { horarios: [] },
    ]) {
      expect((await api(admin.auth).post(platicas, { ...prebautismal, ...cambio })).status).toBe(
        400,
      );
    }
    expect(await prisma.platica.count()).toBe(0);
  });

  it('se puede enlazar a un padre de la iglesia; uno de otra iglesia → 422 (P-14)', async () => {
    const { iglesia, otra, admin, platicas } = await escenario();
    const propio = await prisma.padre.create({
      data: {
        nombre: 'Andrés Ruiz',
        titulo: 'Pbro.',
        iglesias: { create: { iglesiaId: iglesia.id } },
      },
    });
    const ajeno = await prisma.padre.create({
      data: { nombre: 'Tomás Lara', iglesias: { create: { iglesiaId: otra.id } } },
    });
    const conPadre = await api(admin.auth).post(platicas, {
      ...prebautismal,
      tipo: 'PREMATRIMONIAL',
      imparte: 'Pbro. Andrés Ruiz',
      padreId: propio.id,
    });
    expect(conPadre.status).toBe(201);
    expect(conPadre.body.data.padre).toMatchObject({ id: propio.id, titulo: 'Pbro.' });
    expect(
      (await api(admin.auth).post(platicas, { ...prebautismal, padreId: ajeno.id })).status,
    ).toBe(422);
  });

  it('se modifica (horarios reemplazados) y se quita (RF-37)', async () => {
    const { admin, platicas } = await escenario();
    const id = (await api(admin.auth).post(platicas, prebautismal)).body.data.id;
    const r = await api(admin.auth).patch(`${platicas}/${id}`, {
      costo: '150.5',
      horarios: [
        { diaSemana: 5, hora: '18:00' },
        { diaSemana: 2, hora: '18:00' },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      costo: '150.50',
      horarios: [
        { diaSemana: 2, hora: '18:00' },
        { diaSemana: 5, hora: '18:00' },
      ],
    });
    expect((await api(admin.auth).delete(`${platicas}/${id}`)).status).toBe(204);
    expect((await api(admin.auth).get(platicas)).body.data).toEqual([]);
  });
});

describe('acceso (RN-32)', () => {
  it('solo el administrador de la iglesia gestiona servicios y pláticas', async () => {
    const { iglesia, adminOtra, servicios, platicas } = await escenario();
    const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    const coordinacion = await loginComo('COORDINACION');
    for (const quien of [tesorero, adminOtra, coordinacion]) {
      expect((await api(quien.auth).get(servicios)).status).toBe(403);
      expect((await api(quien.auth).post(platicas, prebautismal)).status).toBe(403);
    }
    expect((await request(app).get(`/api/v1${servicios}`)).status).toBe(401);
  });

  it('una iglesia cerrada no acepta cambios (422)', async () => {
    const { iglesia, admin, servicios } = await escenario();
    await prisma.iglesia.update({
      where: { id: iglesia.id },
      data: { activa: false, fechaCierre: new Date('2026-11-01'), motivoCierre: 'Sismo' },
    });
    expect((await api(admin.auth).post(servicios, bautizo)).status).toBe(422);
  });
});

describe('consulta pública (E3-12, E3-14: RF-35, RF-38, RF-39, RN-33)', () => {
  it('«¿cuándo son las pláticas de bautizo?»: filtra por tipo, sin sesión y sin datos internos', async () => {
    const { iglesia, admin, platicas } = await escenario();
    await api(admin.auth).post(platicas, prebautismal);
    await api(admin.auth).post(platicas, { ...prebautismal, tipo: 'CONFIRMACION' });

    const url = `/api/v1/public/iglesias/${iglesia.id}/platicas`;
    const bautizo = await request(app).get(`${url}?tipo=PREBAUTISMAL`);
    expect(bautizo.status).toBe(200);
    expect(bautizo.body.data).toEqual([
      {
        tipo: 'PREBAUTISMAL',
        sesiones: 2,
        costo: '0.00',
        cupo: 30,
        lugar: 'Salón parroquial',
        imparte: 'Matrimonio Pérez',
        horarios: [{ diaSemana: 3, hora: '19:00' }],
      },
    ]);
    expect((await request(app).get(url)).body.data).toHaveLength(2);
    expect((await request(app).get(`${url}?tipo=BAUTIZO`)).status).toBe(400);
  });

  it('una iglesia cerrada o inexistente → 404', async () => {
    const cerrada = await crearIglesia({ nombre: 'Templo cerrado' });
    await prisma.iglesia.update({
      where: { id: cerrada.id },
      data: { activa: false, fechaCierre: new Date('2026-11-01'), motivoCierre: 'Sismo' },
    });
    expect((await request(app).get(`/api/v1/public/iglesias/${cerrada.id}/platicas`)).status).toBe(
      404,
    );
    expect(
      (await request(app).get(`/api/v1/public/iglesias/${crypto.randomUUID()}/platicas`)).status,
    ).toBe(404);
  });

  it('la ficha de la iglesia muestra sus servicios y pláticas (RF-35, RF-38)', async () => {
    const { iglesia, admin, servicios, platicas } = await escenario();
    await api(admin.auth).post(servicios, bautizo);
    await api(admin.auth).post(servicios, { nombre: 'Confirmación', formaCosto: 'GRATUITO' });
    await api(admin.auth).post(platicas, prebautismal);

    const ficha = await request(app).get(`/api/v1/public/iglesias/${iglesia.id}`);
    expect(ficha.status).toBe(200);
    expect(ficha.body.data.servicios.map((s: { nombre: string }) => s.nombre)).toEqual([
      'Bautizo',
      'Confirmación',
    ]);
    expect(ficha.body.data.servicios[0]).toMatchObject({ monto: '350.50', requiereCita: true });
    expect(ficha.body.data.servicios[0]).not.toHaveProperty('id');
    expect(ficha.body.data.platicas).toHaveLength(1);
    expect(ficha.body.data.platicas[0]).not.toHaveProperty('padre');
  });
});
