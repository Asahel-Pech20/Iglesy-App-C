// Deseables de Genaro: RF-84 (armar las misas de la semana desde el horario) y RF-83 (pláticas de un
// tipo en todas las iglesias de un municipio). Supuestos de P-29.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../test/bd';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const DIA = 86_400_000;

const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

/** Domingo de hace `semanas` semanas, «yyyy-MM-dd» (siempre en el pasado). */
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
  await prisma.horarioMisa.createMany({
    data: [
      { iglesiaId: iglesia.id, diaSemana: 0, hora: '10:00', tipo: 'DOMINICAL', padreId: padre.id },
      { iglesiaId: iglesia.id, diaSemana: 3, hora: '19:00', tipo: 'DIARIA', padreId: padre.id },
    ],
  });
  return { iglesia, admin, tesorero, padre };
}

describe('RF-84: la semana de misas se arma desde el horario', () => {
  it('lista las misas de la semana con fecha local, padre programado y estado', async () => {
    const { iglesia, admin } = await conHorario();
    const domingo = domingoHace(2);
    const r = await api(admin.auth).get(`/iglesias/${iglesia.id}/semana-misas?semana=${domingo}`);
    expect(r.status).toBe(200);
    expect(r.body.data.semana).toEqual({ desde: domingo, hasta: masDias(domingo, 6) });
    expect(
      r.body.data.misas.map(
        (m: { fecha: string; hora: string; estado: string }) => `${m.fecha} ${m.hora} ${m.estado}`,
      ),
    ).toEqual([`${domingo} 10:00 PENDIENTE`, `${masDias(domingo, 3)} 19:00 PENDIENTE`]);
    expect(r.body.data.misas[0].padreProgramado).toMatchObject({ nombre: 'Andrés Ruiz' });

    const futura = await api(admin.auth).get(
      `/iglesias/${iglesia.id}/semana-misas?semana=${masDias(domingoHace(0), 14)}`,
    );
    expect(futura.body.data.misas.every((m: { estado: string }) => m.estado === 'FUTURA')).toBe(
      true,
    );
  });

  it('arma la semana: registra las pendientes con su padre programado y no duplica', async () => {
    const { iglesia, admin, padre } = await conHorario();
    const domingo = domingoHace(2);
    const url = `/iglesias/${iglesia.id}/misas-celebradas/semana`;
    const r = await api(admin.auth).post(url, { semana: domingo });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ creadas: 2, yaRegistradas: 0, futuras: 0, omitidas: [] });
    const misas = await prisma.misaCelebrada.findMany({ where: { iglesiaId: iglesia.id } });
    expect(misas).toHaveLength(2);
    expect(misas.every((m) => m.padreId === padre.id && m.horarioMisaId !== null)).toBe(true);

    const otra = await api(admin.auth).post(url, { semana: domingo });
    expect(otra.body.data).toMatchObject({ creadas: 0, yaRegistradas: 2 });
    const semana = await api(admin.auth).get(
      `/iglesias/${iglesia.id}/semana-misas?semana=${domingo}`,
    );
    expect(semana.body.data.misas.every((m: { estado: string }) => m.estado === 'REGISTRADA')).toBe(
      true,
    );
  });

  it('una sustitución registrada antes se respeta; lo que no se puede registrar se informa', async () => {
    const { iglesia, admin, padre } = await conHorario();
    const domingo = domingoHace(3);
    const vicario = await prisma.padre.create({
      data: { nombre: 'Tomás Lara', iglesias: { create: { iglesiaId: iglesia.id } } },
    });
    const dom = await prisma.horarioMisa.findFirstOrThrow({ where: { diaSemana: 0 } });
    // El domingo la dio el vicario (sustitución registrada antes de armar la semana)
    expect(
      (
        await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas`, {
          horarioMisaId: dom.id,
          fecha: domingo,
          padreId: vicario.id,
          motivo: 'El párroco está enfermo.',
        })
      ).status,
    ).toBe(201);
    // El miércoles ya hay otra misa registrada a esa hora en la iglesia
    const miercoles = masDias(domingo, 3);
    await prisma.misaCelebrada.create({
      data: {
        iglesiaId: iglesia.id,
        padreId: padre.id,
        inicio: new Date(`${miercoles}T19:00:00-06:00`),
      },
    });
    const r = await api(admin.auth).post(`/iglesias/${iglesia.id}/misas-celebradas/semana`, {
      semana: domingo,
    });
    expect(r.body.data).toMatchObject({ creadas: 0, yaRegistradas: 1 });
    expect(r.body.data.omitidas).toHaveLength(1);
    expect(r.body.data.omitidas[0].motivo).toContain('Ya hay una misa registrada a esa hora');
  });

  it('el tesorero ve la semana pero no la arma; otra iglesia 403; datos inválidos 400', async () => {
    const { iglesia, tesorero } = await conHorario();
    const otra = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    expect((await api(tesorero.auth).get(`/iglesias/${iglesia.id}/semana-misas`)).status).toBe(200);
    expect(
      (await api(tesorero.auth).post(`/iglesias/${iglesia.id}/misas-celebradas/semana`, {})).status,
    ).toBe(403);
    expect((await api(otra.auth).get(`/iglesias/${iglesia.id}/semana-misas`)).status).toBe(403);
    expect(
      (await api(tesorero.auth).get(`/iglesias/${iglesia.id}/semana-misas?semana=25-11-2026`))
        .status,
    ).toBe(400);
  });
});

describe('RF-83: pláticas de un tipo en todas las iglesias de un municipio', () => {
  async function municipioConIglesias() {
    await prisma.estado.create({ data: { clave: '31', nombre: 'Yucatán' } });
    await prisma.municipio.createMany({
      data: [
        { clave: '31050', estadoClave: '31', nombre: 'Mérida' },
        { clave: '31059', estadoClave: '31', nombre: 'Progreso' },
      ],
    });
    const lugar = (municipioClave: string) => ({ estadoClave: '31', municipioClave });
    const crear = (nombre: string, municipio: string, activa = true) =>
      prisma.iglesia.create({
        data: {
          nombre,
          tipo: 'PARROQUIA',
          ...lugar(municipio),
          activa,
          ...(activa ? {} : { fechaCierre: new Date('2026-01-01'), motivoCierre: 'Sismo' }),
        },
      });
    const santaAna = await crear('Parroquia de Santa Ana', '31050');
    const ermita = await crear('Ermita de Santa Isabel', '31050');
    const cerrada = await crear('Templo cerrado', '31050', false);
    const progreso = await crear('Parroquia de Progreso', '31059');
    const platica = (iglesiaId: string, tipo: 'PREBAUTISMAL' | 'PREMATRIMONIAL', hora: string) =>
      prisma.platica.create({
        data: {
          iglesiaId,
          tipo,
          sesiones: 2,
          costo: '0',
          cupo: 30,
          lugar: 'Salón',
          imparte: 'Equipo de pastoral',
          horarios: { create: [{ diaSemana: 3, hora }] },
        },
      });
    await platica(santaAna.id, 'PREBAUTISMAL', '19:00');
    await platica(ermita.id, 'PREBAUTISMAL', '18:00');
    await platica(ermita.id, 'PREMATRIMONIAL', '20:00');
    await platica(cerrada.id, 'PREBAUTISMAL', '19:00');
    await platica(progreso.id, 'PREBAUTISMAL', '19:00');
  }

  it('sin sesión: las del tipo en las iglesias abiertas del municipio, con su iglesia', async () => {
    await municipioConIglesias();
    const r = await request(app).get('/api/v1/public/platicas?tipo=PREBAUTISMAL&municipio=31050');
    expect(r.status).toBe(200);
    expect(r.body.data.map((g: { iglesia: { nombre: string } }) => g.iglesia.nombre)).toEqual([
      'Ermita de Santa Isabel',
      'Parroquia de Santa Ana',
    ]);
    expect(r.body.data[0].platicas).toEqual([
      expect.objectContaining({
        tipo: 'PREBAUTISMAL',
        horarios: [{ diaSemana: 3, hora: '18:00' }],
      }),
    ]);
    expect(JSON.stringify(r.body.data)).not.toContain('padre');
  });

  it('un municipio sin pláticas de ese tipo responde lista vacía; datos inválidos 400', async () => {
    await municipioConIglesias();
    const vacio = await request(app).get(
      '/api/v1/public/platicas?tipo=CONFIRMACION&municipio=31050',
    );
    expect(vacio.status).toBe(200);
    expect(vacio.body.data).toEqual([]);
    expect((await request(app).get('/api/v1/public/platicas?municipio=31050')).status).toBe(400);
    expect(
      (await request(app).get('/api/v1/public/platicas?tipo=PREBAUTISMAL&municipio=310')).status,
    ).toBe(400);
  });
});
