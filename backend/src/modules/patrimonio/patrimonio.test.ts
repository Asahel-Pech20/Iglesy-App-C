// E2-08 y E2-10 (Nataly): objetos del patrimonio, su estado y los criterios del índice.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { fechaYHoraLocal } from '../../lib/dominio/zona';
import { prisma } from '../../lib/prisma';
import { crearIglesia, loginComo } from '../../test/helpers';

const app = crearApp();
const api = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  put: (url: string, cuerpo?: object) =>
    request(app).put(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});

const imagen = {
  descripcion: 'Imagen de San Miguel Arcángel',
  tipo: 'IMAGEN',
  anio: 1720,
  material: 'Madera policromada',
  estadoConservacion: 'Bueno',
  ubicacionEnTemplo: 'Altar mayor',
  catalogadoInah: true,
};

/** Los cuatro objetos de CA-01 (índice 35.5 calculado en 2026). */
const OBJETOS_CA01 = [
  imagen,
  {
    ...imagen,
    descripcion: 'Retablo lateral',
    tipo: 'RETABLO',
    anio: null,
    siglo: 18,
    catalogadoInah: false,
  },
  {
    ...imagen,
    descripcion: 'Par de candelabros de plata',
    tipo: 'ORFEBRERIA',
    anio: 1890,
    material: 'Plata',
    catalogadoInah: false,
  },
  {
    ...imagen,
    descripcion: 'Piano vertical',
    tipo: 'PIANO',
    anio: 1950,
    material: 'Madera',
    catalogadoInah: false,
  },
];

/** Administrador de una iglesia nueva, con la parroquia de CA-01 ya capturada. */
async function parroquiaCA01() {
  const iglesia = await crearIglesia({ nombre: 'Parroquia de San Miguel Arcángel' });
  const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const ids: Record<string, string> = {};
  for (const o of OBJETOS_CA01) {
    const res = await api(auth).post(`/iglesias/${iglesia.id}/objetos`, o);
    expect(res.status).toBe(201);
    ids[o.tipo] = res.body.data.id as string;
  }
  return { iglesia, auth, ids };
}

describe('Objetos del patrimonio (E2-08)', () => {
  it('RF-13 y RF-17: el administrador registra un objeto; el siglo se muestra como siglo', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    const res = await api(auth).post(`/iglesias/${iglesia.id}/objetos`, {
      ...imagen,
      anio: null,
      siglo: 18,
      descripcion: '  Retablo lateral ',
      tipo: 'RETABLO',
      catalogadoInah: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      descripcion: 'Retablo lateral',
      tipo: 'RETABLO',
      grupo: 'RETABLO_PINTURA_MURAL',
      anio: null,
      siglo: 18,
      epoca: 'siglo XVIII',
      estado: 'VIGENTE',
    });
    expect(res.body.data.puntos).toBe(9.1); // 7 × 1.3 (RN-01, RN-03)
  });

  it('RN-10: sin año ni siglo, con año futuro o con un año de otro siglo responde 400', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    const casos = [
      [{ ...imagen, anio: null }, 'anio'],
      [{ ...imagen, anio: 2999 }, 'anio'],
      [{ ...imagen, anio: 1720, siglo: 17 }, 'siglo'],
      [{ ...imagen, tipo: 'CALIZ' }, 'tipo'],
      [{ ...imagen, ubicacion: 'x' }, undefined],
    ] as const;
    for (const [cuerpo, campo] of casos) {
      const res = await api(auth).post(`/iglesias/${iglesia.id}/objetos`, cuerpo);
      expect(res.status, JSON.stringify(cuerpo)).toBe(400);
      if (campo)
        expect(res.body.error.details).toEqual(
          expect.arrayContaining([expect.objectContaining({ campo })]),
        );
    }
    expect(await prisma.objetoPatrimonial.count()).toBe(0);
  });

  it('RF-14: edita sus datos y valida año y siglo contra lo guardado (400, no 500)', async () => {
    const { iglesia, auth, ids } = await parroquiaCA01();
    const url = `/iglesias/${iglesia.id}/objetos/${ids['RETABLO']}`;
    const editado = await api(auth).patch(url, { material: 'Madera dorada', catalogadoInah: true });
    expect(editado.status).toBe(200);
    expect(editado.body.data).toMatchObject({ material: 'Madera dorada', puntos: 14.1 });
    // Quitar el siglo sin poner año dejaría el objeto sin calificar (RN-10)
    const sinFecha = await api(auth).patch(url, { siglo: null });
    expect(sinFecha.status).toBe(400);
    expect(sinFecha.body.error.details).toEqual([expect.objectContaining({ campo: 'anio' })]);
    // Un año que no es del siglo guardado
    expect((await api(auth).patch(url, { anio: 1650 })).status).toBe(400);
    expect((await api(auth).patch(url, { anio: 1765 })).body.data.epoca).toBe('1765');
  });

  it('RF-14: lista los objetos de su iglesia con filtros y sus puntos', async () => {
    const { iglesia, auth } = await parroquiaCA01();
    const res = await api(auth).get(`/iglesias/${iglesia.id}/objetos`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
    const piano = await api(auth).get(`/iglesias/${iglesia.id}/objetos?tipo=PIANO`);
    expect(piano.body.data).toEqual([
      expect.objectContaining({
        descripcion: 'Piano vertical',
        puntos: 2.4,
        antiguedad: expect.any(Number),
      }),
    ]);
    expect((await api(auth).get(`/iglesias/${iglesia.id}/objetos?estado=OTRO`)).status).toBe(400);
  });

  it('RNF-10: el administrador no entra a los objetos de otra iglesia; un objeto ajeno es 404', async () => {
    const { iglesia, ids } = await parroquiaCA01();
    const otra = await crearIglesia();
    const { auth: ajeno } = await loginComo('ADMIN_IGLESIA', { iglesiaId: otra.id });
    expect((await api(ajeno).get(`/iglesias/${iglesia.id}/objetos`)).status).toBe(403);
    expect((await api(ajeno).post(`/iglesias/${iglesia.id}/objetos`, imagen)).status).toBe(403);
    // El objeto existe, pero no en SU iglesia
    const res = await api(ajeno).patch(`/iglesias/${otra.id}/objetos/${ids['IMAGEN']}`, {
      material: 'Oro',
    });
    expect(res.status).toBe(404);
  });

  it('permisos: la Coordinación consulta pero no captura; el tesorero no entra; sin sesión 401', async () => {
    const { iglesia } = await parroquiaCA01();
    const { auth: coordinacion } = await loginComo('COORDINACION');
    expect((await api(coordinacion).get(`/iglesias/${iglesia.id}/objetos`)).status).toBe(200);
    expect((await api(coordinacion).post(`/iglesias/${iglesia.id}/objetos`, imagen)).status).toBe(
      403,
    );
    const { auth: tesorero } = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    expect((await api(tesorero).get(`/iglesias/${iglesia.id}/objetos`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/iglesias/${iglesia.id}/objetos`)).status).toBe(401);
  });

  it('RF-12: en una iglesia cerrada se consultan sus objetos pero no se capturan (422)', async () => {
    const { iglesia, auth } = await parroquiaCA01();
    await prisma.iglesia.update({ where: { id: iglesia.id }, data: { activa: false } });
    const { auth: coordinacion } = await loginComo('COORDINACION');
    expect((await api(coordinacion).get(`/iglesias/${iglesia.id}/objetos`)).body.meta.total).toBe(
      4,
    );
    expect((await api(auth).post(`/iglesias/${iglesia.id}/objetos`, imagen)).status).toBe(422);
  });
});

describe('Estado de un objeto (RF-15, RN-11)', () => {
  // Día de la zona de la iglesia, como el service; en UTC fallaba de 18:00 a 24:00 en México
  const hoy = fechaYHoraLocal(new Date(), 'America/Mexico_City').fecha;

  it('CA-05: con el piano prestado el índice baja a 33.1 y el piano sigue registrado', async () => {
    const { iglesia, auth, ids } = await parroquiaCA01();
    expect((await api(auth).get(`/iglesias/${iglesia.id}/indice`)).body.data).toMatchObject({
      indice: 35.5,
      distincion: 'Alto valor patrimonial',
    });
    const res = await api(auth).post(`/iglesias/${iglesia.id}/objetos/${ids['PIANO']}/estado`, {
      estado: 'PRESTADO',
      fecha: '2026-01-15',
      motivo: 'Préstamo a la exposición del museo',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      estado: 'PRESTADO',
      fechaEstado: '2026-01-15',
      puntos: 0,
    });
    expect((await api(auth).get(`/iglesias/${iglesia.id}/indice`)).body.data).toMatchObject({
      indice: 33.1,
      distincion: 'Alto valor patrimonial',
      objetosRegistrados: 4,
      objetosVigentes: 3,
    });
    expect(await prisma.objetoPatrimonial.count({ where: { iglesiaId: iglesia.id } })).toBe(4);
  });

  it('P-08 (supuesto): un objeto prestado regresa y vuelve a contar; la baja es definitiva', async () => {
    const { iglesia, auth, ids } = await parroquiaCA01();
    const url = `/iglesias/${iglesia.id}/objetos/${ids['PIANO']}/estado`;
    await api(auth).post(url, { estado: 'PRESTADO', fecha: hoy, motivo: 'Exposición' });
    const regreso = await api(auth).post(url, { estado: 'VIGENTE', fecha: hoy, motivo: 'Regresó' });
    expect(regreso.body.data).toMatchObject({ estado: 'VIGENTE', puntos: 2.4 });

    await api(auth).post(url, { estado: 'BAJA', fecha: hoy, motivo: 'Daño irreparable' });
    expect(
      (await api(auth).post(url, { estado: 'VIGENTE', fecha: hoy, motivo: 'x y z' })).status,
    ).toBe(422);
    const editar = await api(auth).patch(`/iglesias/${iglesia.id}/objetos/${ids['PIANO']}`, {
      material: 'Otro',
    });
    expect(editar.status).toBe(422);
  });

  it('rechaza el mismo estado (422), fecha futura y falta de motivo (400)', async () => {
    const { iglesia, auth, ids } = await parroquiaCA01();
    const url = `/iglesias/${iglesia.id}/objetos/${ids['IMAGEN']}/estado`;
    expect(
      (await api(auth).post(url, { estado: 'VIGENTE', fecha: hoy, motivo: 'Nada' })).status,
    ).toBe(422);
    const futura = await api(auth).post(url, {
      estado: 'PERDIDO',
      fecha: '2999-01-01',
      motivo: 'Robo',
    });
    expect(futura.status).toBe(400);
    expect((await api(auth).post(url, { estado: 'PERDIDO', fecha: hoy })).status).toBe(400);
  });

  it('la BD exige fecha y motivo a un objeto que no está vigente', async () => {
    const iglesia = await crearIglesia();
    await expect(
      prisma.objetoPatrimonial.create({
        data: {
          ...imagen,
          tipo: 'IMAGEN',
          iglesiaId: iglesia.id,
          estado: 'BAJA',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('Criterios del índice (E2-10, RF-22)', () => {
  const criteriosCaso = {
    rangosEdad: [
      { desdeAnios: 0, puntos: 1 },
      { desdeAnios: 50, puntos: 2 },
      { desdeAnios: 100, puntos: 4 },
      { desdeAnios: 200, puntos: 7 },
      { desdeAnios: 300, puntos: 10 },
    ],
    multiplicadores: {
      IMAGEN: 1.5,
      RETABLO_PINTURA_MURAL: 1.3,
      ORGANO_PIANO: 1.2,
      ORFEBRERIA_MOBILIARIO_DOCUMENTO: 1,
      OTRO: 0.8,
    },
    puntosInah: 5,
    distinciones: [
      { minimo: 40, nombre: 'Patrimonio sobresaliente' },
      { minimo: 20, nombre: 'Alto valor patrimonial' },
      { minimo: 8, nombre: 'Valor patrimonial' },
    ],
  };

  it('sin cambios, los criterios vigentes son los del caso', async () => {
    const { auth } = await loginComo('COORDINACION');
    const res = await api(auth).get('/criterios-indice');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ...criteriosCaso,
      id: null,
      vigenteDesde: null,
      creadoPor: null,
    });
  });

  it('CA-07: con 10 puntos del INAH la parroquia pasa a 40.5, Patrimonio sobresaliente, sin cambiar código', async () => {
    const { iglesia, auth } = await parroquiaCA01();
    const { auth: coordinacion, usuario } = await loginComo('COORDINACION');
    const res = await api(coordinacion).put('/criterios-indice', {
      ...criteriosCaso,
      puntosInah: 10,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ puntosInah: 10, creadoPor: { id: usuario.id } });
    expect((await api(auth).get(`/iglesias/${iglesia.id}/indice`)).body.data).toMatchObject({
      indice: 40.5,
      distincion: 'Patrimonio sobresaliente',
    });
    // La versión anterior queda en el historial (no había versión: solo la nueva)
    await api(coordinacion).put('/criterios-indice', criteriosCaso);
    const historial = await api(coordinacion).get('/criterios-indice/historial');
    expect(historial.body.data.map((v: { puntosInah: number }) => v.puntosInah)).toEqual([5, 10]);
  });

  it('rechaza criterios desordenados, con huecos, con más de un decimal o incompletos (400)', async () => {
    const { auth } = await loginComo('COORDINACION');
    const malos = [
      { ...criteriosCaso, rangosEdad: [{ desdeAnios: 10, puntos: 1 }] },
      {
        ...criteriosCaso,
        rangosEdad: [
          { desdeAnios: 0, puntos: 1 },
          { desdeAnios: 0, puntos: 2 },
        ],
      },
      { ...criteriosCaso, puntosInah: 5.25 },
      { ...criteriosCaso, multiplicadores: { IMAGEN: 1.5 } },
      {
        ...criteriosCaso,
        distinciones: [
          { minimo: 8, nombre: 'Valor patrimonial' },
          { minimo: 40, nombre: 'Patrimonio sobresaliente' },
        ],
      },
      {
        ...criteriosCaso,
        distinciones: [
          { minimo: 40, nombre: 'A' },
          { minimo: 20, nombre: 'a' },
        ],
      },
    ];
    for (const cuerpo of malos)
      expect(
        (await api(auth).put('/criterios-indice', cuerpo)).status,
        JSON.stringify(cuerpo),
      ).toBe(400);
    expect(await prisma.criteriosIndice.count()).toBe(0);
  });

  it('solo la Coordinación consulta y cambia los criterios (403) y sin sesión es 401', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
    expect((await api(auth).get('/criterios-indice')).status).toBe(403);
    expect((await api(auth).put('/criterios-indice', criteriosCaso)).status).toBe(403);
    expect((await request(app).get('/api/v1/criterios-indice')).status).toBe(401);
  });
});
