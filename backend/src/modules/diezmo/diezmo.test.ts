// Diezmo de las misas: captura única, corrección con historial, alcance por iglesia y reportes.
// La BD de pruebas se vacía antes de cada prueba (src/test/setup.ts).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';
import { agruparDiezmo, resumirPeriodo, type CapturaReporte } from './dominio/reportes';

const app = crearApp();
const DIA = 24 * 60 * 60 * 1000;
const haceMs = (ms: number) => new Date(Date.now() - ms);

const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

async function crearPadre(nombre = 'Luis Pérez') {
  return prisma.padre.create({ data: { nombre } });
}

/** Una misa ya celebrada de la iglesia (por omisión, hace dos días). */
async function crearMisa(iglesiaId: string, inicio = haceMs(2 * DIA), padreId?: string) {
  const padre = padreId ? { id: padreId } : await crearPadre();
  return prisma.misaCelebrada.create({ data: { iglesiaId, inicio, padreId: padre.id } });
}

async function escenario() {
  const iglesia = await crearIglesia();
  const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  return { iglesia, tesorero, admin };
}

const urlDiezmo = (iglesiaId: string, misaId: string) =>
  `/iglesias/${iglesiaId}/misas-celebradas/${misaId}/diezmo`;

describe('captura de diezmo (RF-60, RF-61, RN-40, RN-41)', () => {
  it('CA-20: el tesorero captura el diezmo de una misa celebrada', async () => {
    const { iglesia, tesorero } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const res = await api(tesorero.auth).post(urlDiezmo(iglesia.id, misa.id), { monto: '1250.50' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      misaId: misa.id,
      monto: '1250.50',
      capturadoPor: { id: tesorero.usuario.id },
      correcciones: [],
    });
  });

  it('CA-20: normaliza el monto a 2 decimales y acepta cero', async () => {
    const { iglesia, tesorero } = await escenario();
    const [a, b] = [await crearMisa(iglesia.id), await crearMisa(iglesia.id, haceMs(3 * DIA))];
    const uno = await api(tesorero.auth).post(urlDiezmo(iglesia.id, a.id), { monto: '1250.5' });
    expect(uno.body.data.monto).toBe('1250.50');
    const cero = await api(tesorero.auth).post(urlDiezmo(iglesia.id, b.id), { monto: '0' });
    expect(cero.status).toBe(201);
    expect(cero.body.data.monto).toBe('0.00');
  });

  it('CA-20: la segunda captura de la misma misa se rechaza con 409 y no cambia nada', async () => {
    const { iglesia, tesorero } = await escenario();
    const misa = await crearMisa(iglesia.id);
    await api(tesorero.auth).post(urlDiezmo(iglesia.id, misa.id), { monto: '100.00' });
    const otra = await api(tesorero.auth).post(urlDiezmo(iglesia.id, misa.id), { monto: '999.00' });
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('CONFLICT');
    expect(await prisma.diezmo.count()).toBe(1);
    expect((await prisma.diezmo.findFirstOrThrow()).monto.toFixed(2)).toBe('100.00');
  });

  it('RN-41: dos capturas simultáneas de la misma misa dejan una sola', async () => {
    const { iglesia, tesorero } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const url = urlDiezmo(iglesia.id, misa.id);
    const respuestas = await Promise.all([
      api(tesorero.auth).post(url, { monto: '10.00' }),
      api(tesorero.auth).post(url, { monto: '20.00' }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.diezmo.count()).toBe(1);
  });

  it('CA-21: no se captura el diezmo de una misa que todavía no se celebra (422)', async () => {
    const { iglesia, tesorero } = await escenario();
    const futura = await crearMisa(iglesia.id, new Date(Date.now() + 2 * DIA));
    const res = await api(tesorero.auth).post(urlDiezmo(iglesia.id, futura.id), { monto: '10.00' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    expect(await prisma.diezmo.count()).toBe(0);
  });

  it.each(['', 'abc', '-5', '12.345', '1,250.50', '1e3', '12345678901.00'])(
    'RN-44: el monto «%s» se rechaza con 400 y el campo monto',
    async (monto) => {
      const { iglesia, tesorero } = await escenario();
      const misa = await crearMisa(iglesia.id);
      const res = await api(tesorero.auth).post(urlDiezmo(iglesia.id, misa.id), { monto });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([expect.objectContaining({ campo: 'monto' })]);
    },
  );

  it('rechaza un monto que no viene como texto y los campos desconocidos', async () => {
    const { iglesia, tesorero } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const url = urlDiezmo(iglesia.id, misa.id);
    expect((await api(tesorero.auth).post(url, { monto: 1250.5 })).status).toBe(400);
    expect((await api(tesorero.auth).post(url, {})).status).toBe(400);
    expect((await api(tesorero.auth).post(url, { monto: '10.00', iglesiaId: 'x' })).status).toBe(
      400,
    );
    expect(await prisma.diezmo.count()).toBe(0);
  });

  it('una misa que no existe responde 404', async () => {
    const { iglesia, tesorero } = await escenario();
    const res = await api(tesorero.auth).post(
      urlDiezmo(iglesia.id, '5f4b8c3e-6a5d-4a53-9a1e-0c1d2e3f4a5b'),
      { monto: '10.00' },
    );
    expect(res.status).toBe(404);
  });
});

describe('alcance por iglesia y permisos (RNF-09, RNF-10, CA-25)', () => {
  it('sin sesión responde 401', async () => {
    const { iglesia } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const url = `/api/v1${urlDiezmo(iglesia.id, misa.id)}`;
    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).post(url).send({ monto: '1.00' })).status).toBe(401);
  });

  it('CA-25: el tesorero de otra iglesia recibe 403 al capturar, leer y corregir', async () => {
    const { iglesia } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const ajeno = await loginComo('TESORERO', { iglesiaId: (await crearIglesia()).id });
    const url = urlDiezmo(iglesia.id, misa.id);
    expect((await api(ajeno.auth).post(url, { monto: '1.00' })).status).toBe(403);
    expect((await api(ajeno.auth).get(url)).status).toBe(403);
    expect((await api(ajeno.auth).patch(url, { monto: '1.00' })).status).toBe(403);
    expect(await prisma.diezmo.count()).toBe(0);
  });

  it('CA-25: el administrador de otra iglesia no ve sus reportes (403)', async () => {
    const { iglesia } = await escenario();
    const ajeno = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    for (const ruta of ['/diezmos', '/diezmo/resumen', '/diezmo/agrupado?por=dia']) {
      expect((await api(ajeno.auth).get(`/iglesias/${iglesia.id}${ruta}`)).status, ruta).toBe(403);
    }
  });

  it('CA-25: la misa de otra iglesia no se alcanza usando la ruta de la propia (404)', async () => {
    const { iglesia, tesorero } = await escenario();
    const otra = await crearIglesia();
    const misaAjena = await crearMisa(otra.id);
    const res = await api(tesorero.auth).post(urlDiezmo(iglesia.id, misaAjena.id), {
      monto: '5.00',
    });
    expect(res.status).toBe(404);
    expect(await prisma.diezmo.count()).toBe(0);
  });

  it('la Coordinación nacional no ve el diezmo de ninguna iglesia (403)', async () => {
    const { iglesia } = await escenario();
    const coordinacion = await loginComo('COORDINACION');
    expect((await api(coordinacion.auth).get(`/iglesias/${iglesia.id}/diezmos`)).status).toBe(403);
    expect(
      (await api(coordinacion.auth).get(`/iglesias/${iglesia.id}/diezmo/resumen`)).status,
    ).toBe(403);
  });

  it.each(['PASTOR', 'SECRETARIO', 'COORDINADOR'] as const)(
    'el rol %s no tiene acceso al diezmo (403)',
    async (rol) => {
      const { iglesia } = await escenario();
      const usuario = await loginComo(rol, { iglesiaId: iglesia.id });
      expect((await api(usuario.auth).get(`/iglesias/${iglesia.id}/diezmos`)).status).toBe(403);
    },
  );

  it('el administrador de la iglesia consulta el diezmo pero no lo captura (403)', async () => {
    const { iglesia, admin } = await escenario();
    const misa = await crearMisa(iglesia.id);
    expect((await api(admin.auth).get(`/iglesias/${iglesia.id}/diezmos`)).status).toBe(200);
    const res = await api(admin.auth).post(urlDiezmo(iglesia.id, misa.id), { monto: '1.00' });
    expect(res.status).toBe(403);
  });

  it('una iglesia que no existe, o con un identificador mal formado, responde 404', async () => {
    const { tesorero } = await escenario();
    const inexistente = '5f4b8c3e-6a5d-4a53-9a1e-0c1d2e3f4a5b';
    expect((await api(tesorero.auth).get(`/iglesias/${inexistente}/diezmos`)).status).toBe(404);
    expect((await api(tesorero.auth).get('/iglesias/no-es-un-uuid/diezmos')).status).toBe(404);
  });
});

describe('corrección con historial (RF-62, RF-63, RN-42, RN-43)', () => {
  async function conCaptura(monto = '1250.50') {
    const e = await escenario();
    const misa = await crearMisa(e.iglesia.id);
    const url = urlDiezmo(e.iglesia.id, misa.id);
    await api(e.tesorero.auth).post(url, { monto });
    return { ...e, misa, url };
  }

  it('CA-22: la corrección guarda quién, cuándo y la cantidad anterior', async () => {
    const { tesorero, url } = await conCaptura();
    const res = await api(tesorero.auth).patch(url, { monto: '1520.50' });
    expect(res.status).toBe(200);
    expect(res.body.data.monto).toBe('1520.50');
    expect(res.body.data.correcciones).toEqual([
      expect.objectContaining({
        montoAnterior: '1250.50',
        montoNuevo: '1520.50',
        hechaPor: expect.objectContaining({ id: tesorero.usuario.id }),
      }),
    ]);
    expect(Date.parse(res.body.data.correcciones[0].hechaEn)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('con varias correcciones el historial lista la más reciente primero', async () => {
    const { tesorero, admin, url } = await conCaptura('100.00');
    await api(tesorero.auth).patch(url, { monto: '200.00' });
    await api(tesorero.auth).patch(url, { monto: '300.00' });
    const res = await api(admin.auth).get(url);
    expect(res.body.data.monto).toBe('300.00');
    expect(res.body.data.correcciones.map((c: { montoNuevo: string }) => c.montoNuevo)).toEqual([
      '300.00',
      '200.00',
    ]);
    expect(res.body.data.correcciones[1].montoAnterior).toBe('100.00');
  });

  it('corregir sin captura previa responde 404', async () => {
    const { iglesia, tesorero } = await escenario();
    const misa = await crearMisa(iglesia.id);
    const res = await api(tesorero.auth).patch(urlDiezmo(iglesia.id, misa.id), { monto: '1.00' });
    expect(res.status).toBe(404);
  });

  it('el mismo monto no es una corrección (422) y no deja historial', async () => {
    const { tesorero, url } = await conCaptura('50.00');
    const res = await api(tesorero.auth).patch(url, { monto: '50' });
    expect(res.status).toBe(422);
    expect(await prisma.diezmoCorreccion.count()).toBe(0);
  });

  it('un monto inválido se rechaza con 400 y no cambia nada', async () => {
    const { tesorero, url } = await conCaptura('50.00');
    const res = await api(tesorero.auth).patch(url, { monto: '12.345' });
    expect(res.status).toBe(400);
    expect((await prisma.diezmo.findFirstOrThrow()).monto.toFixed(2)).toBe('50.00');
    expect(await prisma.diezmoCorreccion.count()).toBe(0);
  });

  it('RN-43: la BD no deja editar ni borrar el historial', async () => {
    const { tesorero, url } = await conCaptura('50.00');
    await api(tesorero.auth).patch(url, { monto: '60.00' });
    const registro = await prisma.diezmoCorreccion.findFirstOrThrow();
    await expect(
      prisma.diezmoCorreccion.update({ where: { id: registro.id }, data: { montoNuevo: '1.00' } }),
    ).rejects.toThrow(/no se puede modificar ni borrar/);
    await expect(prisma.diezmoCorreccion.delete({ where: { id: registro.id } })).rejects.toThrow(
      /no se puede modificar ni borrar/,
    );
    expect((await prisma.diezmoCorreccion.findFirstOrThrow()).montoNuevo.toFixed(2)).toBe('60.00');
  });

  it('correcciones simultáneas: ninguna se pisa y el historial queda encadenado', async () => {
    const { tesorero, url } = await conCaptura('100.00');
    const montos = ['110.00', '120.00', '130.00', '140.00'];
    const respuestas = await Promise.all(
      montos.map((monto) => api(tesorero.auth).patch(url, { monto })),
    );
    const exitosas = respuestas.filter((r) => r.status === 200).length;
    expect(respuestas.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(exitosas).toBeGreaterThanOrEqual(1);

    const diezmo = await prisma.diezmo.findFirstOrThrow({ include: { correcciones: true } });
    expect(diezmo.correcciones).toHaveLength(exitosas);

    // El orden de las horas no es el del commit en una carrera: se sigue la cadena
    // monto anterior → monto nuevo desde la captura original hasta el monto vigente
    let actual = '100.00';
    const pendientes = [...diezmo.correcciones];
    while (pendientes.length > 0) {
      const i = pendientes.findIndex((c) => c.montoAnterior.toFixed(2) === actual);
      expect(i, `ninguna corrección parte de ${actual}`).toBeGreaterThanOrEqual(0);
      actual = pendientes.splice(i, 1)[0]!.montoNuevo.toFixed(2);
    }
    expect(actual).toBe(diezmo.monto.toFixed(2));
  });

  it('la BD no admite montos negativos ni un diezmo de otra iglesia que su misa (RN-44, RNF-10)', async () => {
    const { iglesia, tesorero } = await escenario();
    const otra = await crearIglesia();
    const misa = await crearMisa(iglesia.id);
    await expect(
      prisma.diezmo.create({
        data: {
          misaId: misa.id,
          iglesiaId: iglesia.id,
          monto: '-1.00',
          capturadoPorId: tesorero.usuario.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.diezmo.create({
        data: {
          misaId: misa.id,
          iglesiaId: otra.id,
          monto: '1.00',
          capturadoPorId: tesorero.usuario.id,
        },
      }),
    ).rejects.toThrow(/misma iglesia/);
  });
});

// Las cuatro misas de CA-23/CA-24, hora de la Ciudad de México (UTC−6):
//   dom 8 12:00 Luis 1000.10 · dom 8 18:00 Luis 500.20 · lun 9 12:00 Juan 750.30 · lun 9 18:00 Juan 250.40
const SEMANA = [
  { inicio: '2026-11-08T18:00:00.000Z', monto: '1000.10', padre: 'Luis Pérez' },
  { inicio: '2026-11-09T00:00:00.000Z', monto: '500.20', padre: 'Luis Pérez' },
  { inicio: '2026-11-09T18:00:00.000Z', monto: '750.30', padre: 'Juan Gómez' },
  { inicio: '2026-11-10T00:00:00.000Z', monto: '250.40', padre: 'Juan Gómez' },
];
const PERIODO = 'desde=2026-11-02&hasta=2026-11-15';

async function escenarioReportes(zonaHoraria = 'America/Mexico_City') {
  const iglesia = await crearIglesia({ zonaHoraria });
  const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
  const padres = new Map<string, string>();
  for (const fila of SEMANA) {
    if (!padres.has(fila.padre)) padres.set(fila.padre, (await crearPadre(fila.padre)).id);
    const misa = await prisma.misaCelebrada.create({
      data: {
        iglesiaId: iglesia.id,
        inicio: new Date(fila.inicio),
        padreId: padres.get(fila.padre)!,
      },
    });
    await prisma.diezmo.create({
      data: {
        misaId: misa.id,
        iglesiaId: iglesia.id,
        monto: fila.monto,
        capturadoPorId: tesorero.usuario.id,
      },
    });
  }
  return { iglesia, tesorero, padres };
}

describe('resumen del periodo (RF-64, RF-65, RN-45)', () => {
  it('CA-23: total 2501.00, promedio 625.25, la de más y la de menos', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(`/iglesias/${iglesia.id}/diezmo/resumen?${PERIODO}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      desde: '2026-11-02',
      hasta: '2026-11-15',
      misas: 4,
      total: '2501.00',
      promedio: '625.25',
    });
    expect(res.body.data.conMas).toEqual([
      expect.objectContaining({
        monto: '1000.10',
        inicio: '2026-11-08T18:00:00.000Z',
        fechaLocal: '2026-11-08',
        horaLocal: '12:00',
      }),
    ]);
    expect(res.body.data.conMenos).toEqual([
      expect.objectContaining({ monto: '250.40', inicio: '2026-11-10T00:00:00.000Z' }),
    ]);
  });

  it('el resultado de SQL coincide con el del dominio (mismos datos, mismo resumen)', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(`/iglesias/${iglesia.id}/diezmo/resumen?${PERIODO}`);
    const esperado = resumirPeriodo(await capturasDe(iglesia.id));
    expect(res.body.data.misas).toBe(esperado.misas);
    expect(res.body.data.total).toBe(esperado.total);
    expect(res.body.data.promedio).toBe(esperado.promedio);
    expect(res.body.data.conMas.map((m: { monto: string }) => m.monto)).toEqual(
      esperado.conMas.map((m) => m.monto),
    );
    expect(res.body.data.conMenos.map((m: { monto: string }) => m.monto)).toEqual(
      esperado.conMenos.map((m) => m.monto),
    );
  });

  it('RN-44: suma al centavo montos que en punto flotante fallarían', async () => {
    const { iglesia, tesorero } = await escenario();
    const hace = (d: number) => haceMs(d * DIA);
    for (const [dias, monto] of [
      [1, '0.10'],
      [2, '0.20'],
    ] as const) {
      const misa = await crearMisa(iglesia.id, hace(dias));
      await prisma.diezmo.create({
        data: {
          misaId: misa.id,
          iglesiaId: iglesia.id,
          monto,
          capturadoPorId: tesorero.usuario.id,
        },
      });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = new Date(Date.now() - 5 * DIA).toISOString().slice(0, 10);
    const res = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmo/resumen?desde=${desde}&hasta=${hoy}`,
    );
    expect(res.body.data).toMatchObject({ total: '0.30', promedio: '0.15', misas: 2 });
  });

  it('un periodo sin diezmos da 0.00, sin promedio y sin extremos', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmo/resumen?desde=2025-01-01&hasta=2025-01-31`,
    );
    expect(res.body.data).toMatchObject({
      misas: 0,
      total: '0.00',
      promedio: null,
      conMas: [],
      conMenos: [],
    });
  });

  it('el día final entra completo: una misa de las 23:30 locales del último día cuenta', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmo/resumen?desde=2026-11-09&hasta=2026-11-09`,
    );
    // El lunes 9 local incluye la misa de las 12:00 y la de las 18:00 (martes 00:00 UTC)
    expect(res.body.data).toMatchObject({ misas: 2, total: '1000.70' });
  });

  it('periodo inválido → 400', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const base = `/iglesias/${iglesia.id}/diezmo/resumen`;
    expect((await api(tesorero.auth).get(`${base}?desde=2026-02-30&hasta=2026-03-01`)).status).toBe(
      400,
    );
    expect((await api(tesorero.auth).get(`${base}?desde=2026-11-09&hasta=2026-11-02`)).status).toBe(
      400,
    );
    expect((await api(tesorero.auth).get(`${base}?desde=ayer`)).status).toBe(400);
  });

  it('solo cuenta los diezmos de la propia iglesia', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const otra = await crearIglesia();
    const ajeno = await loginComo('TESORERO', { iglesiaId: otra.id });
    const misa = await crearMisa(otra.id, new Date('2026-11-08T18:00:00.000Z'));
    await prisma.diezmo.create({
      data: {
        misaId: misa.id,
        iglesiaId: otra.id,
        monto: '9999.99',
        capturadoPorId: ajeno.usuario.id,
      },
    });
    const res = await api(tesorero.auth).get(`/iglesias/${iglesia.id}/diezmo/resumen?${PERIODO}`);
    expect(res.body.data.total).toBe('2501.00');
  });
});

async function capturasDe(iglesiaId: string): Promise<CapturaReporte[]> {
  const filas = await prisma.diezmo.findMany({
    where: { iglesiaId },
    select: { misaId: true, monto: true, misa: { select: { inicio: true, padreId: true } } },
  });
  return filas.map((f) => ({
    misaId: f.misaId,
    inicio: f.misa.inicio,
    monto: f.monto.toFixed(2),
    padreId: f.misa.padreId,
  }));
}

describe('diezmo agrupado (RF-66–RF-68)', () => {
  const pedir = async (iglesiaId: string, auth: string, por: string) =>
    api(auth).get(`/iglesias/${iglesiaId}/diezmo/agrupado?${PERIODO}&por=${por}`);

  it('CA-24: por día, en la hora local de la iglesia', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await pedir(iglesia.id, tesorero.auth, 'dia');
    expect(res.status).toBe(200);
    expect(res.body.data.grupos).toEqual([
      expect.objectContaining({ clave: '2026-11-08', misas: 2, total: '1500.30' }),
      expect.objectContaining({ clave: '2026-11-09', misas: 2, total: '1000.70' }),
    ]);
  });

  it('CA-24: por horario de misa', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await pedir(iglesia.id, tesorero.auth, 'horario');
    expect(res.body.data.grupos).toEqual([
      expect.objectContaining({ clave: '12:00', misas: 2, total: '1750.40' }),
      expect.objectContaining({ clave: '18:00', misas: 2, total: '750.60' }),
    ]);
  });

  it('CA-24: por padre, con su nombre', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await pedir(iglesia.id, tesorero.auth, 'padre');
    expect(res.body.data.grupos).toEqual([
      expect.objectContaining({ etiqueta: 'Juan Gómez', misas: 2, total: '1000.70' }),
      expect.objectContaining({ etiqueta: 'Luis Pérez', misas: 2, total: '1500.30' }),
    ]);
  });

  it('por semana (empieza en lunes) y por mes', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const semana = await pedir(iglesia.id, tesorero.auth, 'semana');
    expect(semana.body.data.grupos).toEqual([
      expect.objectContaining({ clave: '2026-11-02', misas: 2, total: '1500.30' }),
      expect.objectContaining({ clave: '2026-11-09', misas: 2, total: '1000.70' }),
    ]);
    const mes = await pedir(iglesia.id, tesorero.auth, 'mes');
    expect(mes.body.data.grupos).toEqual([
      expect.objectContaining({ clave: '2026-11', misas: 4, total: '2501.00' }),
    ]);
  });

  it.each(['dia', 'semana', 'mes', 'horario', 'padre'] as const)(
    'el agrupado por %s de SQL coincide con el del dominio',
    async (por) => {
      const { iglesia, tesorero } = await escenarioReportes();
      const res = await pedir(iglesia.id, tesorero.auth, por);
      const esperado = agruparDiezmo(
        await capturasDe(iglesia.id),
        por.toUpperCase() as 'DIA' | 'SEMANA' | 'MES' | 'HORARIO' | 'PADRE',
        iglesia.zonaHoraria,
      );
      const resumen = (g: { misas: number; total: string }[]) =>
        g.map((x) => `${x.misas}:${x.total}`).sort();
      expect(resumen(res.body.data.grupos)).toEqual(resumen(esperado));
      if (por !== 'padre') {
        expect(res.body.data.grupos.map((g: { clave: string }) => g.clave)).toEqual(
          esperado.map((g) => g.clave),
        );
      }
    },
  );

  it('RN-31: en otra zona horaria las mismas misas caen en otro horario', async () => {
    const { iglesia, tesorero } = await escenarioReportes('America/Tijuana');
    const res = await pedir(iglesia.id, tesorero.auth, 'horario');
    expect(res.body.data.grupos.map((g: { clave: string }) => g.clave)).toEqual(['10:00', '16:00']);
  });

  it('el criterio es obligatorio y debe ser uno de la lista (400)', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const base = `/iglesias/${iglesia.id}/diezmo/agrupado`;
    expect((await api(tesorero.auth).get(base)).status).toBe(400);
    expect((await api(tesorero.auth).get(`${base}?por=siglo`)).status).toBe(400);
  });
});

describe('listado de capturas (RF-64)', () => {
  it('lista las del periodo, la más reciente primero, con su padre y paginadas', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmos?${PERIODO}&limit=3&page=1`,
    );
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(res.body.data.map((d: { monto: string }) => d.monto)).toEqual([
      '250.40',
      '750.30',
      '500.20',
    ]);
    // La misa del domingo 18:00 local ya es lunes en UTC: se muestra con su hora local
    expect(res.body.data[0]).toMatchObject({ padre: { nombre: 'Juan Gómez' }, horaLocal: '18:00' });
    expect(res.body.data[2]).toMatchObject({ fechaLocal: '2026-11-08', horaLocal: '18:00' });
    const segunda = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmos?${PERIODO}&limit=3&page=2`,
    );
    expect(segunda.body.data.map((d: { monto: string }) => d.monto)).toEqual(['1000.10']);
  });

  it('no incluye diezmos de otra iglesia ni fuera del periodo', async () => {
    const { iglesia, tesorero } = await escenarioReportes();
    const res = await api(tesorero.auth).get(
      `/iglesias/${iglesia.id}/diezmos?desde=2026-11-09&hasta=2026-11-09`,
    );
    expect(res.body.meta.total).toBe(2);
  });
});
