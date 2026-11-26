// E3-25 (Genaro): días inhábiles. Una misa del horario no se celebra en una fecha (SIN_MISA) o se
// celebra a otra hora (OTRA_HORA), con motivo. Supuesto P-33.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../test/bd';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const DIA = 86_400_000;

const api = (auth?: string) => {
  const con = (r: request.Test) => (auth ? r.set('Authorization', auth) : r);
  return {
    get: (url: string) => con(request(app).get(`/api/v1${url}`)),
    post: (url: string, cuerpo?: object) => con(request(app).post(`/api/v1${url}`)).send(cuerpo),
    delete: (url: string) => con(request(app).delete(`/api/v1${url}`)),
  };
};

/** Domingo de hace `semanas` semanas (negativo = en el futuro), «yyyy-MM-dd». */
function domingoHace(semanas: number) {
  const d = new Date(Date.now() - semanas * 7 * DIA);
  while (d.getUTCDay() !== 0) d.setTime(d.getTime() - DIA);
  return d.toISOString().slice(0, 10);
}
const masDias = (fecha: string, n: number) =>
  new Date(new Date(`${fecha}T12:00:00Z`).getTime() + n * DIA).toISOString().slice(0, 10);

async function conHorario() {
  const iglesia = await crearIglesia({ nombre: 'Parroquia de San Miguel' });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
  const padre = await prisma.padre.create({
    data: {
      nombre: 'Andrés Ruiz',
      titulo: 'Pbro.',
      iglesias: { create: { iglesiaId: iglesia.id } },
    },
  });
  const domingo = await prisma.horarioMisa.create({
    data: {
      iglesiaId: iglesia.id,
      diaSemana: 0,
      hora: '10:00',
      tipo: 'DOMINICAL',
      padreId: padre.id,
    },
  });
  const miercoles = await prisma.horarioMisa.create({
    data: { iglesiaId: iglesia.id, diaSemana: 3, hora: '19:00', tipo: 'DIARIA', padreId: padre.id },
  });
  const url = `/iglesias/${iglesia.id}/excepciones-misa`;
  return { iglesia, admin, tesorero, padre, domingo, miercoles, url };
}

describe('E3-25: días inhábiles de una misa del horario', () => {
  it('SIN_MISA: la semana la marca, armarla la salta y no se puede registrar ese día', async () => {
    const { iglesia, admin, domingo, url } = await conHorario();
    const dom = domingoHace(2);
    const r = await api(admin.auth).post(url, {
      horarioMisaId: domingo.id,
      fecha: dom,
      tipo: 'SIN_MISA',
      motivo: 'Templo cerrado por reparación del techo.',
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({
      fecha: dom,
      tipo: 'SIN_MISA',
      horaNueva: null,
      misa: { hora: '10:00', diaSemana: 0, padre: { nombre: 'Andrés Ruiz' } },
    });

    const semana = await api(admin.auth).get(`/iglesias/${iglesia.id}/semana-misas?semana=${dom}`);
    expect(
      semana.body.data.misas.map(
        (m: { fecha: string; estado: string }) => `${m.fecha} ${m.estado}`,
      ),
    ).toEqual([`${dom} SIN_MISA`, `${masDias(dom, 3)} PENDIENTE`]);
    expect(semana.body.data.misas[0].excepcion).toMatchObject({
      tipo: 'SIN_MISA',
      motivo: 'Templo cerrado por reparación del techo.',
    });

    const armada = await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas/semana`, {
      semana: dom,
    });
    expect(armada.body.data).toMatchObject({ creadas: 1, sinMisa: 1, omitidas: [] });

    const directa = await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas`, {
      horarioMisaId: domingo.id,
      fecha: dom,
    });
    expect(directa.status).toBe(422);
    expect(directa.body.error.message).toContain('sin misa');
  });

  it('OTRA_HORA: la semana, el registro y la agenda usan la hora nueva', async () => {
    const { iglesia, admin, padre, miercoles, url } = await conHorario();
    const mie = masDias(domingoHace(2), 3);
    const r = await api(admin.auth).post(url, {
      horarioMisaId: miercoles.id,
      fecha: mie,
      tipo: 'OTRA_HORA',
      horaNueva: '08:00',
      motivo: 'Fiesta patronal: la misa se adelanta.',
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ tipo: 'OTRA_HORA', horaNueva: '08:00' });

    const semana = await api(admin.auth).get(`/iglesias/${iglesia.id}/semana-misas?semana=${mie}`);
    const misa = semana.body.data.misas.find((m: { fecha: string }) => m.fecha === mie);
    expect(misa).toMatchObject({ hora: '08:00', estado: 'PENDIENTE' });
    expect(misa.excepcion).toMatchObject({ tipo: 'OTRA_HORA', horaHorario: '19:00' });

    const registrada = await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas`, {
      horarioMisaId: miercoles.id,
      fecha: mie,
    });
    expect(registrada.status).toBe(201);
    expect(registrada.body.data).toMatchObject({ fechaLocal: mie, horaLocal: '08:00' });

    const agenda = await api(admin.auth).get(`/padres/${padre.id}/agenda?semana=${mie}`);
    const enAgenda = agenda.body.data.misas.find((m: { fecha: string }) => m.fecha === mie);
    expect(enAgenda).toMatchObject({ hora: '08:00', excepcion: { tipo: 'OTRA_HORA' } });
  });

  it('reglas: día del horario, datos coherentes, una por fecha, ya celebrada y choque del padre', async () => {
    const { iglesia, admin, padre, domingo, miercoles, url } = await conHorario();
    const dom = domingoHace(-2);
    const base = { horarioMisaId: domingo.id, motivo: 'Retiro parroquial.' };
    const crear = (cuerpo: object) => api(admin.auth).post(url, { ...base, ...cuerpo });

    // La fecha no cae en el día de esa misa
    expect((await crear({ fecha: masDias(dom, 1), tipo: 'SIN_MISA' })).status).toBe(422);
    // OTRA_HORA sin hora, SIN_MISA con hora, la misma hora del horario, motivo vacío
    expect((await crear({ fecha: dom, tipo: 'OTRA_HORA' })).status).toBe(400);
    expect((await crear({ fecha: dom, tipo: 'SIN_MISA', horaNueva: '12:00' })).status).toBe(400);
    expect((await crear({ fecha: dom, tipo: 'OTRA_HORA', horaNueva: '10:00' })).status).toBe(400);
    expect((await crear({ fecha: dom, tipo: 'SIN_MISA', motivo: ' ' })).status).toBe(400);
    // Una por misa y fecha
    expect((await crear({ fecha: dom, tipo: 'SIN_MISA' })).status).toBe(201);
    expect((await crear({ fecha: dom, tipo: 'SIN_MISA' })).status).toBe(409);

    // A la hora nueva el padre ya tiene otra misa (en otra iglesia): RN-26
    const otraIglesia = await crearIglesia({ nombre: 'Capilla del Carmen' });
    await prisma.padreIglesia.create({ data: { padreId: padre.id, iglesiaId: otraIglesia.id } });
    await prisma.horarioMisa.create({
      data: {
        iglesiaId: otraIglesia.id,
        diaSemana: 3,
        hora: '12:00',
        tipo: 'DIARIA',
        padreId: padre.id,
      },
    });
    const mie = masDias(dom, 3);
    const choque = await api(admin.auth).post(url, {
      horarioMisaId: miercoles.id,
      fecha: mie,
      tipo: 'OTRA_HORA',
      horaNueva: '12:30',
      motivo: 'Cambio por boda.',
    });
    expect(choque.status).toBe(409);
    expect(choque.body.error.message).toContain('Capilla del Carmen');

    // Ya celebrada: no se marca ni se quita
    const pasado = domingoHace(1);
    expect(
      (
        await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas`, {
          horarioMisaId: domingo.id,
          fecha: pasado,
        })
      ).status,
    ).toBe(201);
    expect((await crear({ fecha: pasado, tipo: 'SIN_MISA' })).status).toBe(409);
  });

  it('quitar la excepción regresa la misa a su horario; no si ya se celebró', async () => {
    const { iglesia, admin, miercoles, url } = await conHorario();
    const mie = masDias(domingoHace(2), 3);
    const creada = await api(admin.auth).post(url, {
      horarioMisaId: miercoles.id,
      fecha: mie,
      tipo: 'OTRA_HORA',
      horaNueva: '08:00',
      motivo: 'Fiesta patronal.',
    });
    // Se celebró a la hora nueva: ya no se puede quitar
    await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas`, {
      horarioMisaId: miercoles.id,
      fecha: mie,
    });
    expect((await api(admin.auth).delete(`${url}/${creada.body.data.id}`)).status).toBe(409);

    const futura = await api(admin.auth).post(url, {
      horarioMisaId: miercoles.id,
      fecha: masDias(domingoHace(-1), 3),
      tipo: 'SIN_MISA',
      motivo: 'Peregrinación.',
    });
    expect((await api(admin.auth).delete(`${url}/${futura.body.data.id}`)).status).toBe(204);
    expect(await prisma.excepcionMisa.count({ where: { id: futura.body.data.id } })).toBe(0);
    expect((await api(admin.auth).delete(`${url}/${futura.body.data.id}`)).status).toBe(404);
  });

  it('permisos: el tesorero solo consulta, otra iglesia 403, sin sesión 401', async () => {
    const { iglesia, tesorero, domingo, url } = await conHorario();
    const otra = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    const cuerpo = {
      horarioMisaId: domingo.id,
      fecha: domingoHace(-1),
      tipo: 'SIN_MISA',
      motivo: 'Retiro.',
    };
    expect((await api(tesorero.auth).get(url)).status).toBe(200);
    expect((await api(tesorero.auth).post(url, cuerpo)).status).toBe(403);
    expect((await api(otra.auth).post(url, cuerpo)).status).toBe(403);
    expect((await api(otra.auth).get(url)).status).toBe(403);
    expect((await api().get(url)).status).toBe(401);
    expect(await prisma.excepcionMisa.count({ where: { iglesiaId: iglesia.id } })).toBe(0);
  });

  it('público: ve los próximos cambios sin datos internos; iglesia cerrada 404', async () => {
    const { iglesia, admin, domingo, miercoles, url } = await conHorario();
    const proxDom = domingoHace(-1);
    await api(admin.auth).post(url, {
      horarioMisaId: domingo.id,
      fecha: proxDom,
      tipo: 'SIN_MISA',
      motivo: 'Templo en reparación.',
    });
    // Una del pasado no sale por omisión (de hoy a 60 días)
    await api(admin.auth).post(url, {
      horarioMisaId: miercoles.id,
      fecha: masDias(domingoHace(3), 3),
      tipo: 'SIN_MISA',
      motivo: 'Ya pasó.',
    });
    const r = await api().get(`/public/iglesias/${iglesia.id}/excepciones-misa`);
    expect(r.status).toBe(200);
    expect(r.body.data.excepciones).toEqual([
      {
        fecha: proxDom,
        diaSemana: 0,
        hora: '10:00',
        tipoMisa: 'DOMINICAL',
        tipo: 'SIN_MISA',
        horaNueva: null,
        motivo: 'Templo en reparación.',
        padre: 'Pbro. Andrés Ruiz',
      },
    ]);
    expect(JSON.stringify(r.body)).not.toContain('registradoPor');

    const cerrada = await crearIglesia({ activa: false });
    expect((await api().get(`/public/iglesias/${cerrada.id}/excepciones-misa`)).status).toBe(404);
    expect((await api().get('/public/iglesias/no-es-uuid/excepciones-misa')).status).toBe(400);
  });

  it('la base exige coherencia del tipo y la misma iglesia que el horario', async () => {
    const { iglesia, admin, domingo } = await conHorario();
    const otra = await crearIglesia();
    const datos = {
      iglesiaId: iglesia.id,
      horarioMisaId: domingo.id,
      fecha: new Date(domingoHace(-3)),
      motivo: 'Prueba de la base.',
      registradoPorId: admin.usuario.id,
    };
    await expect(
      prisma.excepcionMisa.create({ data: { ...datos, tipo: 'OTRA_HORA' } }),
    ).rejects.toThrow();
    await expect(
      prisma.excepcionMisa.create({ data: { ...datos, tipo: 'SIN_MISA', horaNueva: '09:00' } }),
    ).rejects.toThrow();
    await expect(
      prisma.excepcionMisa.create({ data: { ...datos, iglesiaId: otra.id, tipo: 'SIN_MISA' } }),
    ).rejects.toThrow();
  });
});
