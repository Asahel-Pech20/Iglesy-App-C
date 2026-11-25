// E3-08 (agenda del padre), E3-09 (misa celebrada desde el horario y sustitución) y E3-10
// (horario público en la ficha).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../test/bd';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const DIA = 24 * 60 * 60 * 1000;

const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

/** Fecha «yyyy-MM-dd» pasada (al menos 7 días atrás) que cae en el día indicado (0 = domingo). */
function fechaPasada(diaSemana: number, semanasAtras = 1): string {
  const base = new Date(Date.now() - semanasAtras * 7 * DIA);
  while (base.getUTCDay() !== diaSemana) base.setTime(base.getTime() - DIA);
  return base.toISOString().slice(0, 10);
}

async function escenario() {
  const parroquia = await crearIglesia({ nombre: 'Parroquia de San Miguel' });
  const capilla = await crearIglesia({ nombre: 'Capilla de la Merced', tipo: 'CAPILLA' });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: parroquia.id });
  const tesorero = await loginComo('TESORERO', { iglesiaId: parroquia.id });
  const adminCapilla = await loginComo('ADMIN_IGLESIA', { iglesiaId: capilla.id });
  const titular = await prisma.padre.create({
    data: {
      nombre: 'Andrés Ruiz',
      titulo: 'Pbro.',
      iglesias: { create: [{ iglesiaId: parroquia.id }, { iglesiaId: capilla.id }] },
    },
  });
  const vicario = await prisma.padre.create({
    data: {
      nombre: 'Tomás Lara',
      titulo: 'Fr.',
      iglesias: { create: { iglesiaId: parroquia.id } },
    },
  });
  // Domingo 10:00 en la parroquia con el titular
  const horario = await prisma.horarioMisa.create({
    data: {
      iglesiaId: parroquia.id,
      diaSemana: 0,
      hora: '10:00',
      tipo: 'DOMINICAL',
      padreId: titular.id,
    },
  });
  const url = `/iglesias/${parroquia.id}/misas-celebradas`;
  return { parroquia, capilla, admin, tesorero, adminCapilla, titular, vicario, horario, url };
}

describe('misa celebrada desde el horario (E3-09: RF-48, RN-29)', () => {
  it('sin cambio de padre: la hora sale del horario y no hay sustitución', async () => {
    const { admin, titular, horario, url } = await escenario();
    const fecha = fechaPasada(0);
    const r = await api(admin.auth).post(url, { horarioMisaId: horario.id, fecha });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      fechaLocal: fecha,
      horaLocal: '10:00',
      horarioMisaId: horario.id,
      padre: { id: titular.id },
      sustitucion: null,
      diezmo: null,
    });
    const guardada = await prisma.misaCelebrada.findUniqueOrThrow({
      where: { id: r.body.data.id },
    });
    expect(guardada.registradoPorId).toBe(admin.usuario.id);
    expect(guardada.fecha?.toISOString().slice(0, 10)).toBe(fecha);
  });

  it('con sustitución: guarda quién la dio, el programado, quién cambió y por qué (RF-49, RF-50)', async () => {
    const { admin, tesorero, titular, vicario, horario, url } = await escenario();
    const fecha = fechaPasada(0);
    const r = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha,
      padreId: vicario.id,
      motivo: 'El párroco está enfermo.',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.padre.id).toBe(vicario.id);
    expect(r.body.data.sustitucion).toMatchObject({
      padreProgramado: { id: titular.id, nombre: 'Andrés Ruiz' },
      motivo: 'El párroco está enfermo.',
      hechaPor: { id: admin.usuario.id },
    });

    // RF-51: el personal de la iglesia consulta quién la dio realmente y por qué
    const lista = await api(tesorero.auth).get(`${url}?desde=${fecha}&hasta=${fecha}`);
    expect(lista.status).toBe(200);
    expect(lista.body.data[0].sustitucion.motivo).toBe('El párroco está enfermo.');
    expect(lista.body.data[0].padre.nombre).toBe('Tomás Lara');
  });

  it('la sustitución necesita motivo, y el motivo solo va con sustitución (400)', async () => {
    const { admin, vicario, horario, url } = await escenario();
    const fecha = fechaPasada(0);
    const sinMotivo = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha,
      padreId: vicario.id,
    });
    expect(sinMotivo.status).toBe(400);
    expect(JSON.stringify(sinMotivo.body.error.details)).toContain('motivo');
    const motivoSobrante = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha,
      motivo: 'Nada cambió.',
    });
    expect(motivoSobrante.status).toBe(400);
    expect(await prisma.misaCelebrada.count()).toBe(0);
  });

  it('el sustituto debe estar asociado a la iglesia (422)', async () => {
    const { admin, horario, url } = await escenario();
    const ajeno = await prisma.padre.create({ data: { nombre: 'Julián Mena' } });
    const r = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha: fechaPasada(0),
      padreId: ajeno.id,
      motivo: 'Suplencia.',
    });
    expect(r.status).toBe(422);
  });

  it('el sustituto no puede tener su propia misa a esa hora, aunque sea en otra iglesia (409)', async () => {
    const { capilla, admin, vicario, horario, url } = await escenario();
    await prisma.padreIglesia.create({ data: { padreId: vicario.id, iglesiaId: capilla.id } });
    await prisma.horarioMisa.create({
      data: {
        iglesiaId: capilla.id,
        diaSemana: 0,
        hora: '10:30',
        tipo: 'DOMINICAL',
        padreId: vicario.id,
      },
    });
    const r = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha: fechaPasada(0),
      padreId: vicario.id,
      motivo: 'Suplencia.',
    });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toContain('domingo a las 10:30 en Capilla de la Merced');
  });

  it('la fecha debe caer en el día del horario y no estar en el futuro (422)', async () => {
    const { admin, horario, url } = await escenario();
    const lunes = fechaPasada(1);
    const otroDia = await api(admin.auth).post(url, { horarioMisaId: horario.id, fecha: lunes });
    expect(otroDia.status).toBe(422);
    expect(otroDia.body.error.message).toContain('lunes');

    let futuro = new Date(Date.now() + 7 * DIA);
    while (futuro.getUTCDay() !== 0) futuro = new Date(futuro.getTime() + DIA);
    const enElFuturo = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha: futuro.toISOString().slice(0, 10),
    });
    expect(enElFuturo.status).toBe(422);
  });

  it('una misa del horario se registra una vez por fecha, aun en paralelo (409)', async () => {
    const { admin, horario, url } = await escenario();
    const fecha = fechaPasada(0);
    const [a, b] = await Promise.all([
      api(admin.auth).post(url, { horarioMisaId: horario.id, fecha }),
      api(admin.auth).post(url, { horarioMisaId: horario.id, fecha }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await api(admin.auth).post(url, { horarioMisaId: horario.id, fecha })).status).toBe(
      409,
    );
    expect(await prisma.misaCelebrada.count()).toBe(1);
    // El domingo anterior sí
    const otra = await api(admin.auth).post(url, {
      horarioMisaId: horario.id,
      fecha: fechaPasada(0, 2),
    });
    expect(otra.status).toBe(201);
  });

  it('un horario de otra iglesia → 404; datos mezclados o faltantes → 400', async () => {
    const { capilla, adminCapilla, horario, admin, url } = await escenario();
    const ajena = await api(adminCapilla.auth).post(`/iglesias/${capilla.id}/misas-celebradas`, {
      horarioMisaId: horario.id,
      fecha: fechaPasada(0),
    });
    expect(ajena.status).toBe(404);
    expect((await api(admin.auth).post(url, { fecha: fechaPasada(0) })).status).toBe(400);
    expect(
      (await api(admin.auth).post(url, { horarioMisaId: horario.id, fecha: '2026/11/22' })).status,
    ).toBe(400);
  });

  it('la forma del diezmo (inicio y padre) sigue funcionando y guarda quién la registró', async () => {
    const { admin, titular, url } = await escenario();
    const r = await api(admin.auth).post(url, {
      inicio: new Date(Date.now() - 2 * DIA).toISOString(),
      padreId: titular.id,
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ horarioMisaId: null, sustitucion: null });
    const guardada = await prisma.misaCelebrada.findUniqueOrThrow({
      where: { id: r.body.data.id },
    });
    expect(guardada.registradoPorId).toBe(admin.usuario.id);
  });

  it('el tesorero no registra misas (403)', async () => {
    const { tesorero, horario, url } = await escenario();
    const r = await api(tesorero.auth).post(url, {
      horarioMisaId: horario.id,
      fecha: fechaPasada(0),
    });
    expect(r.status).toBe(403);
  });
});

describe('agenda semanal de un padre (E3-08: RF-47, supuesto P-18)', () => {
  async function conAgenda() {
    const e = await escenario();
    const cancun = await crearIglesia({
      nombre: 'Parroquia de Cancún',
      zonaHoraria: 'America/Cancun',
    });
    const cerrada = await crearIglesia({ nombre: 'Templo cerrado' });
    await prisma.padreIglesia.createMany({
      data: [
        { padreId: e.titular.id, iglesiaId: cancun.id },
        { padreId: e.titular.id, iglesiaId: cerrada.id },
      ],
    });
    await prisma.horarioMisa.createMany({
      data: [
        // Domingo 09:00 en Cancún = 14:00 UTC, antes que la de las 10:00 en la parroquia (16:00 UTC)
        {
          iglesiaId: cancun.id,
          diaSemana: 0,
          hora: '09:00',
          tipo: 'DOMINICAL',
          padreId: e.titular.id,
        },
        {
          iglesiaId: e.capilla.id,
          diaSemana: 3,
          hora: '19:00',
          tipo: 'DIARIA',
          padreId: e.titular.id,
        },
        {
          iglesiaId: cerrada.id,
          diaSemana: 2,
          hora: '08:00',
          tipo: 'DIARIA',
          padreId: e.titular.id,
        },
      ],
    });
    await prisma.iglesia.update({
      where: { id: cerrada.id },
      data: { activa: false, fechaCierre: new Date('2026-11-01'), motivoCierre: 'Sismo' },
    });
    return { ...e, cancun };
  }

  it('reúne sus misas de todas las iglesias, en la hora local de cada una y en orden real', async () => {
    const { admin, titular } = await conAgenda();
    const r = await api(admin.auth).get(`/padres/${titular.id}/agenda?semana=2026-11-25`);
    expect(r.status).toBe(200);
    expect(r.body.data.padre).toMatchObject({
      id: titular.id,
      nombre: 'Andrés Ruiz',
      titulo: 'Pbro.',
    });
    expect(r.body.data.semana).toEqual({ desde: '2026-11-22', hasta: '2026-11-28' });
    const resumen = r.body.data.misas.map(
      (m: { iglesia: { nombre: string }; fecha: string; hora: string }) =>
        `${m.fecha} ${m.hora} ${m.iglesia.nombre}`,
    );
    expect(resumen).toEqual([
      '2026-11-22 09:00 Parroquia de Cancún',
      '2026-11-22 10:00 Parroquia de San Miguel',
      '2026-11-25 19:00 Capilla de la Merced',
    ]);
    expect(r.body.data.misas[0].inicio).toBe('2026-11-22T14:00:00.000Z');
  });

  it('sin semana usa la semana en curso', async () => {
    const { admin, titular } = await conAgenda();
    const r = await api(admin.auth).get(`/padres/${titular.id}/agenda`);
    expect(r.status).toBe(200);
    expect(r.body.data.misas).toHaveLength(3);
  });

  it('la ven la Coordinación y el personal de sus iglesias; otra iglesia no (403)', async () => {
    const { titular, vicario, tesorero, adminCapilla } = await conAgenda();
    const coordinacion = await loginComo('COORDINACION');
    const otra = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    const url = `/padres/${titular.id}/agenda`;
    expect((await api(coordinacion.auth).get(url)).status).toBe(200);
    expect((await api(tesorero.auth).get(url)).status).toBe(200);
    expect((await api(adminCapilla.auth).get(url)).status).toBe(200);
    expect((await api(otra.auth).get(url)).status).toBe(403);
    // El vicario no celebra en la capilla
    expect((await api(adminCapilla.auth).get(`/padres/${vicario.id}/agenda`)).status).toBe(403);
  });

  it('padre inexistente → 404; semana mal escrita → 400; sin sesión → 401', async () => {
    const { admin, titular } = await conAgenda();
    expect((await api(admin.auth).get(`/padres/${crypto.randomUUID()}/agenda`)).status).toBe(404);
    expect(
      (await api(admin.auth).get(`/padres/${titular.id}/agenda?semana=25-11-2026`)).status,
    ).toBe(400);
    expect((await request(app).get(`/api/v1/padres/${titular.id}/agenda`)).status).toBe(401);
  });
});

describe('horario público en la ficha (E3-10: RF-44, RF-52, RN-33)', () => {
  it('la ficha muestra el horario con el padre (solo título y nombre), sin sesión', async () => {
    const { parroquia, vicario } = await escenario();
    await prisma.horarioMisa.createMany({
      data: [
        {
          iglesiaId: parroquia.id,
          diaSemana: 0,
          hora: '08:00',
          tipo: 'DOMINICAL',
          idioma: 'NAHUATL',
          padreId: vicario.id,
        },
        {
          iglesiaId: parroquia.id,
          diaSemana: 1,
          hora: '07:00',
          tipo: 'DIARIA',
          padreId: vicario.id,
          activo: false,
        },
      ],
    });
    const r = await request(app).get(`/api/v1/public/iglesias/${parroquia.id}`);
    expect(r.status).toBe(200);
    expect(r.body.data.misas).toEqual([
      {
        diaSemana: 0,
        hora: '08:00',
        tipo: 'DOMINICAL',
        idioma: 'NAHUATL',
        duracionMin: null,
        padre: 'Fr. Tomás Lara',
      },
      {
        diaSemana: 0,
        hora: '10:00',
        tipo: 'DOMINICAL',
        idioma: 'ESPANOL',
        duracionMin: null,
        padre: 'Pbro. Andrés Ruiz',
      },
    ]);
    // Nunca datos internos del padre
    expect(JSON.stringify(r.body.data.misas)).not.toContain(vicario.id);
  });

  it('la hora es la local de la iglesia, sin convertirla (RF-52)', async () => {
    const cancun = await crearIglesia({
      nombre: 'Parroquia de Cancún',
      zonaHoraria: 'America/Cancun',
    });
    const padre = await prisma.padre.create({
      data: { nombre: 'Rafael Soto', iglesias: { create: { iglesiaId: cancun.id } } },
    });
    await prisma.horarioMisa.create({
      data: {
        iglesiaId: cancun.id,
        diaSemana: 0,
        hora: '09:00',
        tipo: 'DOMINICAL',
        padreId: padre.id,
      },
    });
    const r = await request(app).get(`/api/v1/public/iglesias/${cancun.id}`);
    expect(r.body.data.misas[0]).toMatchObject({ hora: '09:00', padre: 'Rafael Soto' });
  });
});
