// Iglesias: base de Oscar (la Coordinación las lista y las crea) y E2-06 de Nataly.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';
import * as catalogosService from '../catalogos/catalogos.service';
import * as iglesiasService from './iglesias.service';

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

// ───────────── E2-06 (Nataly): ubicación del INEGI, datos, edición y cierre ─────────────

const FILAS_INEGI = [
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
];

const parroquia = {
  nombre: 'Parroquia de San Miguel Arcángel',
  tipo: 'PARROQUIA',
  direccion: 'Calle 5 de Mayo 10, Centro',
  estado: '21',
  municipio: '21114',
  localidad: '211140001',
  capacidad: 400,
  anioConstruccion: 1765,
  telefono: '222 123 4567',
  correo: 'Contacto@Parroquia.mx',
  latitud: 19.0431,
  longitud: '-98.1982',
};

const enviar = (metodo: 'patch' | 'post', url: string, auth: string, cuerpo?: object) =>
  request(app)[metodo](`/api/v1${url}`).set('Authorization', auth).send(cuerpo);

describe('POST /iglesias con ubicación y datos (RF-07, RN-09, CA-09)', () => {
  it('guarda la ubicación del catálogo y los datos de contacto normalizados', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).post('/iglesias', parroquia);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      direccion: 'Calle 5 de Mayo 10, Centro',
      estado: { clave: '21', nombre: 'Puebla' },
      municipio: { clave: '21114', nombre: 'Puebla' },
      localidad: { clave: '211140001', nombre: 'Heroica Puebla de Zaragoza' },
      capacidad: 400,
      anioConstruccion: 1765,
      telefono: '2221234567',
      correo: 'contacto@parroquia.mx',
      latitud: '19.043100',
      longitud: '-98.198200',
      fechaCierre: null,
    });
  });

  it('CA-09: rechaza un municipio de otro estado, señala el campo y no guarda nada', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const { auth } = await loginComo('COORDINACION');
    const { localidad: _sinLocalidad, ...sinLocalidad } = parroquia;
    const res = await api(auth).post('/iglesias', { ...sinLocalidad, municipio: '31050' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ campo: 'municipio' })]);
    expect(await prisma.iglesia.count()).toBe(0);
  });

  it('valida capacidad, año, correo, clave y coordenadas sueltas o fuera de rango (400)', async () => {
    const { auth } = await loginComo('COORDINACION');
    const base = { nombre: 'X', tipo: 'TEMPLO' };
    const malos = [
      { ...base, capacidad: 0 },
      { ...base, anioConstruccion: 1200 },
      { ...base, correo: 'no-es-correo' },
      { ...base, latitud: 19.04 },
      { ...base, latitud: 95, longitud: -98 },
      { ...base, estado: 'Puebla' },
    ];
    for (const cuerpo of malos)
      expect((await api(auth).post('/iglesias', cuerpo)).status).toBe(400);
    expect(await prisma.iglesia.count()).toBe(0);
  });
});

describe('GET /iglesias con filtros (RF-12)', () => {
  it('filtra por estado y por situación', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const { auth } = await loginComo('COORDINACION');
    await api(auth).post('/iglesias', parroquia);
    await api(auth).post('/iglesias', {
      nombre: 'Catedral de Mérida',
      tipo: 'CATEDRAL',
      estado: '31',
      municipio: '31050',
    });
    await crearIglesia({ nombre: 'Capilla cerrada', activa: false });

    const dePuebla = await api(auth).get('/iglesias?estado=21');
    expect(dePuebla.body.data.map((i: { nombre: string }) => i.nombre)).toEqual([
      'Parroquia de San Miguel Arcángel',
    ]);
    const cerradas = await api(auth).get('/iglesias?situacion=cerradas');
    expect(cerradas.body.data.map((i: { nombre: string }) => i.nombre)).toEqual([
      'Capilla cerrada',
    ]);
    expect((await api(auth).get('/iglesias?situacion=activas')).body.meta.total).toBe(2);
  });
});

describe('GET y PATCH /iglesias/:iglesiaId (RF-08)', () => {
  it('el administrador ve y edita SU iglesia; la ubicación se valida contra el catálogo', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const iglesia = await crearIglesia({ nombre: 'Templo de Atlixco' });
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });

    const leida = await api(auth).get(`/iglesias/${iglesia.id}`);
    expect(leida.body.data.nombre).toBe('Templo de Atlixco');

    const res = await enviar('patch', `/iglesias/${iglesia.id}`, auth, {
      estado: '21',
      municipio: '21019',
      capacidad: 150,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      municipio: { clave: '21019', nombre: 'Atlixco' },
      capacidad: 150,
    });

    // Cambiar solo el estado deja sin municipio: el anterior ya no le corresponde
    const otroEstado = await enviar('patch', `/iglesias/${iglesia.id}`, auth, { estado: '31' });
    expect(otroEstado.body.data).toMatchObject({ estado: { clave: '31' }, municipio: null });

    const mala = await enviar('patch', `/iglesias/${iglesia.id}`, auth, { municipio: '21114' });
    expect(mala.status).toBe(400);
  });

  it('RNF-10: el administrador de otra iglesia no la ve ni la edita (403)', async () => {
    const mia = await crearIglesia();
    const ajena = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: mia.id });
    expect((await api(auth).get(`/iglesias/${ajena.id}`)).status).toBe(403);
    const res = await enviar('patch', `/iglesias/${ajena.id}`, auth, { capacidad: 10 });
    expect(res.status).toBe(403);
  });

  it('la Coordinación edita cualquiera; el tesorero no tiene permiso; 404 si no existe', async () => {
    const iglesia = await crearIglesia();
    const coordinacion = await loginComo('COORDINACION');
    const res = await enviar('patch', `/iglesias/${iglesia.id}`, coordinacion.auth, {
      nombre: 'Nuevo nombre',
    });
    expect(res.body.data.nombre).toBe('Nuevo nombre');

    const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    expect((await api(tesorero.auth).get(`/iglesias/${iglesia.id}`)).status).toBe(403);

    const inexistente = '00000000-0000-4000-8000-000000000000';
    expect((await api(coordinacion.auth).get(`/iglesias/${inexistente}`)).status).toBe(404);
  });

  it('no repite nombre (409), valida el cuerpo (400) y no edita una cerrada (422)', async () => {
    await crearIglesia({ nombre: 'San Juan' });
    const iglesia = await crearIglesia({ nombre: 'San Pedro' });
    const cerrada = await crearIglesia({ activa: false });
    const { auth } = await loginComo('COORDINACION');
    const url = `/iglesias/${iglesia.id}`;
    expect((await enviar('patch', url, auth, { nombre: 'san juan' })).status).toBe(409);
    expect((await enviar('patch', url, auth, {})).status).toBe(400);
    expect((await enviar('patch', url, auth, { activa: false })).status).toBe(400);
    const res = await enviar('patch', `/iglesias/${cerrada.id}`, auth, { capacidad: 5 });
    expect(res.status).toBe(422);
  });
});

describe('POST /iglesias/:iglesiaId/cierre (RF-11, RN-07)', () => {
  it('la Coordinación la cierra con fecha y motivo sin borrar nada', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('COORDINACION');
    const res = await enviar('post', `/iglesias/${iglesia.id}/cierre`, auth, {
      fecha: '2017-09-19',
      motivo: 'Daños por el sismo',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      activa: false,
      fechaCierre: '2017-09-19',
      motivoCierre: 'Daños por el sismo',
    });
    expect(await prisma.iglesia.count()).toBe(1);

    const otraVez = await enviar('post', `/iglesias/${iglesia.id}/cierre`, auth, {
      fecha: '2017-09-20',
      motivo: 'Repetido',
    });
    expect(otraVez.status).toBe(422);
  });

  it('rechaza fecha futura o sin motivo (400); el administrador no cierra (403)', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('COORDINACION');
    const url = `/iglesias/${iglesia.id}/cierre`;
    const malos = [
      { fecha: '2999-01-01', motivo: 'Futuro' },
      { fecha: '2017-09-19', motivo: '' },
      { fecha: '19/09/2017', motivo: 'Formato' },
    ];
    for (const cuerpo of malos) expect((await enviar('post', url, auth, cuerpo)).status).toBe(400);

    const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    const cuerpo = { fecha: '2017-09-19', motivo: 'Daños' };
    expect((await enviar('post', url, admin.auth, cuerpo)).status).toBe(403);
  });

  it('la BD exige que una iglesia con fecha de cierre esté cerrada', async () => {
    const iglesia = await crearIglesia();
    await expect(
      prisma.iglesia.update({
        where: { id: iglesia.id },
        data: { fechaCierre: new Date('2017-09-19T00:00:00.000Z') },
      }),
    ).rejects.toThrow();
  });
});

describe('iglesiasService.obtenerActiva (para otros módulos)', () => {
  it('devuelve la iglesia activa y rechaza una cerrada (422) o inexistente (404)', async () => {
    const activa = await crearIglesia({ nombre: 'Activa' });
    const cerrada = await crearIglesia({ activa: false });
    await expect(iglesiasService.obtenerActiva(activa.id)).resolves.toMatchObject({
      nombre: 'Activa',
    });
    await expect(iglesiasService.obtenerActiva(cerrada.id)).rejects.toMatchObject({ status: 422 });
    await expect(
      iglesiasService.obtenerActiva('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
