// E2-05: catálogo del INEGI (RF-09, RF-10, RN-09, RNF-05).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';
import * as catalogosService from './catalogos.service';

const app = crearApp();

// Muestra pequeña con claves reales del INEGI
const FILAS = [
  {
    cveEnt: '21',
    nomEnt: 'Puebla',
    cveMun: '114',
    nomMun: 'Puebla',
    cveLoc: '0001',
    nomLoc: 'Heroica Puebla de Zaragoza',
  },
  {
    cveEnt: '21',
    nomEnt: 'Puebla',
    cveMun: '019',
    nomMun: 'Atlixco',
    cveLoc: '0001',
    nomLoc: 'Atlixco',
  },
  {
    cveEnt: '31',
    nomEnt: 'Yucatán',
    cveMun: '050',
    nomMun: 'Mérida',
    cveLoc: '0001',
    nomLoc: 'Mérida',
  },
  { cveEnt: '09', nomEnt: 'Ciudad de México' },
];

async function importar(auth: string, filas: object[] = FILAS) {
  return request(app)
    .post('/api/v1/catalogos/importacion')
    .set('Authorization', auth)
    .send({ filas });
}

describe('POST /catalogos/importacion (RF-10)', () => {
  it('la Coordinación carga estados, municipios y localidades con sus claves completas', async () => {
    const { auth } = await loginComo('COORDINACION');
    const res = await importar(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      leidas: { estados: 3, municipios: 3, localidades: 3 },
      cambiadas: { estados: 3, municipios: 3, localidades: 3 },
    });
    expect(await prisma.municipio.findUnique({ where: { clave: '21114' } })).toMatchObject({
      estadoClave: '21',
      nombre: 'Puebla',
    });
    expect(await prisma.localidad.findUnique({ where: { clave: '211140001' } })).toMatchObject({
      municipioClave: '21114',
    });
  });

  it('volver a cargar no duplica: solo actualiza los nombres que cambiaron', async () => {
    const { auth } = await loginComo('COORDINACION');
    await importar(auth);
    const cambiada = FILAS.map((f) =>
      f.cveMun === '019' ? { ...f, nomMun: 'Atlixco (actualizado)' } : f,
    );
    const res = await importar(auth, cambiada);
    expect(res.body.data.cambiadas).toEqual({ estados: 0, municipios: 1, localidades: 0 });
    expect(await prisma.municipio.count()).toBe(3);
    expect((await prisma.municipio.findUnique({ where: { clave: '21019' } }))?.nombre).toBe(
      'Atlixco (actualizado)',
    );
  });

  it('carga municipios de un estado que ya estaba en el catálogo', async () => {
    const { auth } = await loginComo('COORDINACION');
    await importar(auth, [{ cveEnt: '21', nomEnt: 'Puebla' }]);
    const sinEstado = { cveEnt: '21', nomEnt: 'Puebla', cveMun: '156', nomMun: 'Tehuacán' };
    expect((await importar(auth, [sinEstado])).status).toBe(200);
    expect(await prisma.municipio.count({ where: { estadoClave: '21' } })).toBe(1);
  });

  it('rechaza claves mal formadas, filas incompletas y campos desconocidos (400) sin guardar nada', async () => {
    const { auth } = await loginComo('COORDINACION');
    const malas = [
      [{ cveEnt: '1', nomEnt: 'X' }],
      [{ cveEnt: '21', nomEnt: 'Puebla', cveMun: '114' }],
      [{ cveEnt: '21', nomEnt: 'Puebla', cveLoc: '0001', nomLoc: 'Sin municipio' }],
      [{ cveEnt: '21', nomEnt: 'Puebla', poblacion: 10 }],
      [],
    ];
    for (const filas of malas) expect((await importar(auth, filas)).status).toBe(400);
    expect(await prisma.estado.count()).toBe(0);
  });

  it('solo la Coordinación carga el catálogo (403) y sin sesión es 401', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    expect((await importar(auth)).status).toBe(403);
    expect(
      (await request(app).post('/api/v1/catalogos/importacion').send({ filas: FILAS })).status,
    ).toBe(401);
  });

  it('la BD rechaza una clave de municipio que no empieza con la de su estado', async () => {
    await prisma.estado.create({ data: { clave: '21', nombre: 'Puebla' } });
    await expect(
      prisma.municipio.create({ data: { clave: '31050', estadoClave: '21', nombre: 'Mal' } }),
    ).rejects.toThrow();
  });
});

describe('consulta pública del catálogo (RF-01, RF-09)', () => {
  it('lista estados, municipios del estado y localidades del municipio sin sesión', async () => {
    await catalogosService.importar(FILAS);
    const estados = await request(app).get('/api/v1/public/estados');
    expect(estados.status).toBe(200);
    expect(estados.body.data.map((e: { clave: string }) => e.clave)).toEqual(['09', '21', '31']);

    const municipios = await request(app).get('/api/v1/public/estados/21/municipios');
    expect(municipios.body.data).toEqual([
      { clave: '21019', nombre: 'Atlixco' },
      { clave: '21114', nombre: 'Puebla' },
    ]);

    const localidades = await request(app).get('/api/v1/public/municipios/31050/localidades');
    expect(localidades.body.data).toEqual([{ clave: '310500001', nombre: 'Mérida' }]);
  });

  it('404 si el estado o el municipio no existen y 400 si la clave está mal formada', async () => {
    await catalogosService.importar(FILAS);
    expect((await request(app).get('/api/v1/public/estados/99/municipios')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/municipios/99999/localidades')).status).toBe(
      404,
    );
    expect((await request(app).get('/api/v1/public/estados/abc/municipios')).status).toBe(400);
  });
});

describe('validarUbicacion (RN-09)', () => {
  it('acepta una ubicación consistente o vacía', async () => {
    await catalogosService.importar(FILAS);
    await expect(
      catalogosService.validarUbicacion({
        estado: '21',
        municipio: '21114',
        localidad: '211140001',
      }),
    ).resolves.toBeUndefined();
    await expect(catalogosService.validarUbicacion({})).resolves.toBeUndefined();
  });

  it('señala el campo que no coincide con el catálogo', async () => {
    await catalogosService.importar(FILAS);
    const casos = [
      [{ estado: '21', municipio: '31050' }, 'municipio'],
      [{ estado: '21', municipio: '21114', localidad: '210190001' }, 'localidad'],
      [{ estado: '99' }, 'estado'],
      [{ municipio: '21114' }, 'estado'],
      [{ estado: '21', localidad: '211140001' }, 'municipio'],
    ] as const;
    for (const [ubicacion, campo] of casos) {
      await expect(catalogosService.validarUbicacion(ubicacion)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([expect.objectContaining({ campo })]),
      });
    }
  });
});
