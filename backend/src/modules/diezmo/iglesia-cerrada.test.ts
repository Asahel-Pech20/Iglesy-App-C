// Una iglesia cerrada conserva su historia pero no acepta escrituras (RF-11, RF-12, RN-07, A2-E1-01,
// A2-E4-01). Lo aplica `alcanceIglesia` con `aceptaEscrituras`; aquí se comprueba con las rutas
// REALES de padres, misas y diezmo (no con una ruta de prueba). Que las escrituras se rechacen y
// las lecturas sigan funcionando es un supuesto: el caso solo dice que una iglesia cerrada no
// aparece en consultas y conserva su historia.
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
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

/** Una iglesia con una misa que ya tiene diezmo y otra sin capturar, y su personal. */
async function escenario() {
  const iglesia = await crearIglesia();
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
  const padre = await prisma.padre.create({ data: { nombre: 'Luis Pérez' } });
  const crearMisa = (hace: number) =>
    prisma.misaCelebrada.create({
      data: { iglesiaId: iglesia.id, inicio: new Date(Date.now() - hace * DIA), padreId: padre.id },
    });
  const conDiezmo = await crearMisa(3);
  await prisma.diezmo.create({
    data: {
      misaId: conDiezmo.id,
      iglesiaId: iglesia.id,
      monto: '1000.00',
      capturadoPorId: tesorero.usuario.id,
    },
  });
  const sinCapturar = await crearMisa(2);
  return { iglesia, admin, tesorero, padre, conDiezmo, sinCapturar };
}

const cerrar = (id: string) => prisma.iglesia.update({ where: { id }, data: { activa: false } });
const base = (iglesiaId: string) => `/iglesias/${iglesiaId}`;

describe('iglesia activa: todo sigue funcionando (control de las pruebas siguientes)', () => {
  it('registra misa y padre, captura y corrige el diezmo', async () => {
    const { iglesia, admin, tesorero, padre, conDiezmo, sinCapturar } = await escenario();
    const url = base(iglesia.id);
    expect((await api(admin.auth).post(`${url}/padres`, { nombre: 'Juan Gómez' })).status).toBe(
      201,
    );
    const misa = await api(admin.auth).post(`${url}/misas-celebradas`, {
      inicio: new Date(Date.now() - DIA).toISOString(),
      padreId: padre.id,
    });
    expect(misa.status).toBe(201);
    const captura = await api(tesorero.auth).post(
      `${url}/misas-celebradas/${sinCapturar.id}/diezmo`,
      { monto: '500.00' },
    );
    expect(captura.status).toBe(201);
    const correccion = await api(tesorero.auth).patch(
      `${url}/misas-celebradas/${conDiezmo.id}/diezmo`,
      { monto: '1200.00' },
    );
    expect(correccion.status).toBe(200);
  });
});

describe('iglesia cerrada: no acepta escrituras (422) y no guarda nada', () => {
  it('no registra padres ni misas celebradas', async () => {
    const { iglesia, admin, padre } = await escenario();
    await cerrar(iglesia.id);
    const url = base(iglesia.id);
    const padres = await prisma.padre.count();
    const misas = await prisma.misaCelebrada.count();

    const nuevoPadre = await api(admin.auth).post(`${url}/padres`, { nombre: 'Juan Gómez' });
    expect(nuevoPadre.status).toBe(422);
    expect(nuevoPadre.body.error.code).toBe('BUSINESS_RULE');
    const nuevaMisa = await api(admin.auth).post(`${url}/misas-celebradas`, {
      inicio: new Date(Date.now() - DIA).toISOString(),
      padreId: padre.id,
    });
    expect(nuevaMisa.status).toBe(422);
    expect(nuevaMisa.body.error.code).toBe('BUSINESS_RULE');

    expect(await prisma.padre.count()).toBe(padres);
    expect(await prisma.misaCelebrada.count()).toBe(misas);
  });

  it('no captura el diezmo de una misa', async () => {
    const { iglesia, tesorero, sinCapturar } = await escenario();
    await cerrar(iglesia.id);
    const res = await api(tesorero.auth).post(
      `${base(iglesia.id)}/misas-celebradas/${sinCapturar.id}/diezmo`,
      { monto: '500.00' },
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    expect(await prisma.diezmo.count({ where: { misaId: sinCapturar.id } })).toBe(0);
  });

  it('no corrige un diezmo ya capturado y su historial no cambia', async () => {
    const { iglesia, tesorero, conDiezmo } = await escenario();
    await cerrar(iglesia.id);
    const res = await api(tesorero.auth).patch(
      `${base(iglesia.id)}/misas-celebradas/${conDiezmo.id}/diezmo`,
      { monto: '1200.00' },
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    const guardado = await prisma.diezmo.findUniqueOrThrow({ where: { misaId: conDiezmo.id } });
    expect(guardado.monto.toFixed(2)).toBe('1000.00');
    expect(await prisma.diezmoCorreccion.count()).toBe(0);
  });

  it('el rechazo no depende del cuerpo: aun con datos inválidos la iglesia cerrada responde igual', async () => {
    const { iglesia, tesorero, sinCapturar } = await escenario();
    await cerrar(iglesia.id);
    const res = await api(tesorero.auth).post(
      `${base(iglesia.id)}/misas-celebradas/${sinCapturar.id}/diezmo`,
      { monto: 'no es un monto' },
    );
    expect(res.status).toBe(422);
    expect(await prisma.diezmo.count({ where: { misaId: sinCapturar.id } })).toBe(0);
  });
});

describe('iglesia cerrada: las lecturas siguen funcionando para conservar la historia', () => {
  it('lista padres y misas, ve el diezmo y consulta los reportes', async () => {
    const { iglesia, admin, tesorero, conDiezmo } = await escenario();
    await cerrar(iglesia.id);
    const url = base(iglesia.id);
    const periodo = 'desde=2000-01-01&hasta=2999-12-31';

    expect((await api(admin.auth).get(`${url}/padres`)).status).toBe(200);
    const misas = await api(admin.auth).get(`${url}/misas-celebradas?${periodo}`);
    expect(misas.status).toBe(200);
    expect(misas.body.meta.total).toBe(2);

    const diezmo = await api(tesorero.auth).get(`${url}/misas-celebradas/${conDiezmo.id}/diezmo`);
    expect(diezmo.status).toBe(200);
    expect(diezmo.body.data.monto).toBe('1000.00');
    expect((await api(tesorero.auth).get(`${url}/diezmos?${periodo}`)).status).toBe(200);

    const resumen = await api(admin.auth).get(`${url}/diezmo/resumen?${periodo}`);
    expect(resumen.status).toBe(200);
    expect(resumen.body.data.total).toBe('1000.00');
    expect((await api(admin.auth).get(`${url}/diezmo/agrupado?${periodo}&por=mes`)).status).toBe(
      200,
    );
  });
});

describe('cerrar una iglesia no afecta a las demás', () => {
  it('otra iglesia activa sigue capturando diezmo', async () => {
    const cerrada = await escenario();
    await cerrar(cerrada.iglesia.id);
    const otra = await escenario();
    const res = await api(otra.tesorero.auth).post(
      `${base(otra.iglesia.id)}/misas-celebradas/${otra.sinCapturar.id}/diezmo`,
      { monto: '750.00' },
    );
    expect(res.status).toBe(201);
  });

  it('el personal de una iglesia cerrada no escribe en otra (sigue siendo 403 por alcance)', async () => {
    const cerrada = await escenario();
    const otra = await escenario();
    await cerrar(cerrada.iglesia.id);
    const res = await api(cerrada.tesorero.auth).post(
      `${base(otra.iglesia.id)}/misas-celebradas/${otra.sinCapturar.id}/diezmo`,
      { monto: '750.00' },
    );
    expect(res.status).toBe(403);
  });
});
