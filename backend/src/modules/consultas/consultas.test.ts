// Consultas públicas (E2-07, E2-11–E2-13, Nataly): ficha, iglesias reconocidas y búsqueda.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { loginComo } from '../../test/helpers';
import * as catalogosService from '../catalogos/catalogos.service';

const app = crearApp();
const publica = (url: string) => request(app).get(`/api/v1/public${url}`);
const nombres = (res: request.Response) =>
  res.body.data.map((i: { nombre: string }) => i.nombre) as string[];

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

type Objeto = {
  descripcion: string;
  tipo: 'IMAGEN' | 'RETABLO' | 'ORFEBRERIA' | 'PIANO' | 'DOCUMENTO' | 'OTRO';
  anio?: number;
  siglo?: number;
  catalogadoInah?: boolean;
  estado?: 'VIGENTE' | 'PERDIDO' | 'PRESTADO' | 'BAJA';
};

/** Iglesia activa en Puebla (o donde se indique) con sus objetos, creada directo en la BD. */
async function iglesiaCon(
  nombre: string,
  objetos: Objeto[],
  datos: { activa?: boolean; municipio?: string; estado?: string } = {},
) {
  const estado = datos.estado ?? '21';
  const municipio = datos.municipio ?? '21114';
  return prisma.iglesia.create({
    data: {
      nombre,
      tipo: 'PARROQUIA',
      activa: datos.activa ?? true,
      estadoClave: estado,
      municipioClave: municipio,
      direccion: 'Calle 5 de Mayo 10',
      telefono: '2221234567',
      objetos: {
        create: objetos.map((o) => ({
          material: 'Madera',
          estadoConservacion: 'Bueno',
          ubicacionEnTemplo: 'Sacristía',
          catalogadoInah: false,
          ...o,
          ...(o.estado &&
            o.estado !== 'VIGENTE' && {
              fechaEstado: new Date('2026-01-01'),
              motivoEstado: 'Prueba',
            }),
        })),
      },
    },
  });
}

/** Los cuatro objetos de CA-01 (35.5, Alto valor patrimonial, calculado en 2026). */
const OBJETOS_CA01: Objeto[] = [
  {
    descripcion: 'Imagen de San Miguel Arcángel',
    tipo: 'IMAGEN',
    anio: 1720,
    catalogadoInah: true,
  },
  { descripcion: 'Retablo lateral', tipo: 'RETABLO', siglo: 18 },
  { descripcion: 'Par de candelabros de plata', tipo: 'ORFEBRERIA', anio: 1890 },
  { descripcion: 'Piano vertical', tipo: 'PIANO', anio: 1950 },
];

/** Iglesia A de CA-06: índice 45 (tres imágenes de 300 años o más: 3 × 10 × 1.5). */
const OBJETOS_45: Objeto[] = [
  { descripcion: 'Imagen 1', tipo: 'IMAGEN', anio: 1600 }, // 15
  { descripcion: 'Imagen 2', tipo: 'IMAGEN', anio: 1600 }, // 15
  { descripcion: 'Imagen 3', tipo: 'IMAGEN', anio: 1600 }, // 15
];

describe('GET /public/iglesias (E2-07 + RF-18)', () => {
  it('CA-02: cada iglesia de la lista trae su índice y su distinción', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Parroquia de San Miguel', OBJETOS_CA01);
    await iglesiaCon('Capilla sin objetos', []);
    const res = await publica('/iglesias?estado=21');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ nombre: 'Capilla sin objetos', indice: 0, distincion: null }),
      expect.objectContaining({
        nombre: 'Parroquia de San Miguel',
        indice: 35.5,
        distincion: 'Alto valor patrimonial',
      }),
    ]);
    expect(res.body.data[0]).not.toHaveProperty('zonaHoraria');
  });
});

describe('GET /public/iglesias/:iglesiaId (E2-11, ficha)', () => {
  it('CA-04: datos, los cuatro objetos vigentes, 35.5 y su distinción; no el dado de baja', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const iglesia = await iglesiaCon('Parroquia de San Miguel', [
      ...OBJETOS_CA01,
      { descripcion: 'Cáliz antiguo', tipo: 'ORFEBRERIA', anio: 1700, estado: 'BAJA' },
    ]);
    const res = await publica(`/iglesias/${iglesia.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: iglesia.id,
      nombre: 'Parroquia de San Miguel',
      ubicacion: {
        direccion: 'Calle 5 de Mayo 10',
        estado: { clave: '21', nombre: 'Puebla' },
        municipio: { clave: '21114', nombre: 'Puebla' },
        localidad: null,
      },
      contacto: { telefono: '2221234567', correo: null },
      indice: 35.5,
      distincion: 'Alto valor patrimonial',
      anioCalculo: expect.any(Number),
      servicios: [],
      platicas: [],
      misas: [],
      tiposEspacio: [],
    });
    const objetos = res.body.data.objetos as { descripcion: string; epoca: string }[];
    expect(objetos.map((o) => o.descripcion)).toEqual([
      'Imagen de San Miguel Arcángel',
      'Par de candelabros de plata',
      'Piano vertical',
      'Retablo lateral',
    ]);
    expect(objetos[3]).toMatchObject({ epoca: 'siglo XVIII' });
    // P-05 (supuesto): la ubicación en el templo y la conservación no son públicas
    expect(objetos[0]).not.toHaveProperty('ubicacionEnTemplo');
    expect(objetos[0]).not.toHaveProperty('estadoConservacion');
    expect(res.body.data).not.toHaveProperty('coordenadas');
    expect(res.body.data).not.toHaveProperty('zonaHoraria');
  });

  it('404 si la iglesia está cerrada o no existe; 400 si el id no es válido', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const cerrada = await iglesiaCon('Templo cerrado', OBJETOS_CA01, { activa: false });
    expect((await publica(`/iglesias/${cerrada.id}`)).status).toBe(404);
    expect((await publica('/iglesias/7b1f0b5e-8a7c-4f1e-9a51-2a8c6f0e4d11')).status).toBe(404);
    expect((await publica('/iglesias/abc')).status).toBe(400);
  });
});

describe('GET /public/reconocidas (E2-12, ranking)', () => {
  it('CA-06: primero A (45) y después la parroquia (35.5); no la cerrada ni la que no tiene objetos', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Parroquia de San Miguel', OBJETOS_CA01);
    await iglesiaCon('Iglesia A', OBJETOS_45);
    await iglesiaCon('Iglesia C cerrada', [...OBJETOS_45, ...OBJETOS_45], { activa: false });
    await iglesiaCon('Iglesia D sin objetos', []);
    const res = await publica('/reconocidas?estado=21');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        posicion: 1,
        nombre: 'Iglesia A',
        indice: 45,
        distincion: 'Patrimonio sobresaliente',
      }),
      expect.objectContaining({
        posicion: 2,
        nombre: 'Parroquia de San Miguel',
        indice: 35.5,
        distincion: 'Alto valor patrimonial',
      }),
    ]);
    expect(res.body.meta.total).toBe(2);
  });

  it('RF-19 y RF-20: ranking del país, de un municipio y paginado', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Parroquia de San Miguel', OBJETOS_CA01);
    await iglesiaCon('Parroquia de Atlixco', OBJETOS_45, { municipio: '21019' });
    await iglesiaCon(
      'Catedral de Mérida',
      [{ descripcion: 'Documento', tipo: 'DOCUMENTO', anio: 2000 }],
      {
        estado: '31',
        municipio: '31050',
      },
    );
    expect(nombres(await publica('/reconocidas'))).toEqual([
      'Parroquia de Atlixco',
      'Parroquia de San Miguel',
      'Catedral de Mérida',
    ]);
    expect(nombres(await publica('/reconocidas?municipio=21114'))).toEqual([
      'Parroquia de San Miguel',
    ]);
    const pagina = await publica('/reconocidas?limit=1&page=2');
    expect(pagina.body.data).toEqual([
      expect.objectContaining({ posicion: 2, nombre: 'Parroquia de San Miguel' }),
    ]);
  });

  it('CA-07: al cambiar los criterios cambia también el ranking', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Parroquia de San Miguel', OBJETOS_CA01);
    const { auth } = await loginComo('COORDINACION');
    const vigentes = await request(app).get('/api/v1/criterios-indice').set('Authorization', auth);
    const { id: _id, vigenteDesde: _v, creadoPor: _c, ...criterios } = vigentes.body.data;
    await request(app)
      .put('/api/v1/criterios-indice')
      .set('Authorization', auth)
      .send({ ...criterios, puntosInah: 10 });
    expect((await publica('/reconocidas?estado=21')).body.data[0]).toMatchObject({
      indice: 40.5,
      distincion: 'Patrimonio sobresaliente',
    });
  });

  it('P-07 (supuesto): una iglesia con objetos pero ninguno vigente no entra', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Todo prestado', [
      { descripcion: 'Imagen', tipo: 'IMAGEN', anio: 1600, estado: 'PRESTADO' },
    ]);
    expect((await publica('/reconocidas')).body.data).toEqual([]);
  });

  it('400 con más de un nivel de lugar o una clave mal formada', async () => {
    expect((await publica('/reconocidas?estado=21&municipio=21114')).status).toBe(400);
    expect((await publica('/reconocidas?estado=2')).status).toBe(400);
  });
});

describe('GET /public/busqueda-patrimonio (E2-13)', () => {
  it('CA-08: imágenes de 300 años o más en Puebla: solo la iglesia X', async () => {
    await catalogosService.importar(FILAS_INEGI);
    await iglesiaCon('Iglesia X', [{ descripcion: 'Imagen de 1700', tipo: 'IMAGEN', anio: 1700 }]);
    await iglesiaCon('Iglesia Y', [{ descripcion: 'Imagen de 1750', tipo: 'IMAGEN', anio: 1750 }]);
    await iglesiaCon('Iglesia Z', [
      { descripcion: 'Retablo de 1600', tipo: 'RETABLO', anio: 1600 },
    ]);
    await iglesiaCon('Iglesia cerrada', [{ descripcion: 'Imagen', tipo: 'IMAGEN', anio: 1600 }], {
      activa: false,
    });
    await iglesiaCon('Iglesia con imagen perdida', [
      { descripcion: 'Imagen', tipo: 'IMAGEN', anio: 1600, estado: 'PERDIDO' },
    ]);
    const res = await publica('/busqueda-patrimonio?tipoObjeto=IMAGEN&antiguedadMin=300&estado=21');
    expect(res.status).toBe(200);
    expect(nombres(res)).toEqual(['Iglesia X']);
    expect(res.body.data[0].objetos).toEqual([
      expect.objectContaining({ descripcion: 'Imagen de 1700', epoca: '1700' }),
    ]);
  });

  it('RN-02: un objeto con solo el siglo cuenta desde la mitad del siglo', async () => {
    await catalogosService.importar(FILAS_INEGI);
    // Siglo XVII → 1650: en 2026 tiene 376 años
    await iglesiaCon('Iglesia del siglo XVII', [
      { descripcion: 'Imagen', tipo: 'IMAGEN', siglo: 17 },
    ]);
    const res = await publica(
      '/busqueda-patrimonio?tipoObjeto=IMAGEN&antiguedadMin=350&municipio=21114',
    );
    expect(nombres(res)).toEqual(['Iglesia del siglo XVII']);
    expect(res.body.data[0].objetos[0]).toMatchObject({ epoca: 'siglo XVII' });
  });

  it('400 sin lugar, sin tipo o con una antigüedad negativa', async () => {
    for (const url of [
      '/busqueda-patrimonio?tipoObjeto=IMAGEN&antiguedadMin=300',
      '/busqueda-patrimonio?antiguedadMin=300&estado=21',
      '/busqueda-patrimonio?tipoObjeto=IMAGEN&antiguedadMin=-1&estado=21',
      '/busqueda-patrimonio?tipoObjeto=IMAGEN&antiguedadMin=300&estado=21&localidad=211140001',
    ])
      expect((await publica(url)).status, url).toBe(400);
  });
});

describe('ficha: tipos de espacio de Oscar (E2-11 + E4-08)', () => {
  it('muestra los tipos activos y disponibles, sin precios; no los que no hay', async () => {
    await catalogosService.importar(FILAS_INEGI);
    const iglesia = await iglesiaCon('Parroquia con criptas', []);
    await prisma.tipoEspacio.createMany({
      data: [
        { iglesiaId: iglesia.id, clase: 'CRIPTA' },
        { iglesiaId: iglesia.id, clase: 'NICHO', disponible: false },
        { iglesiaId: iglesia.id, clase: 'OSARIO', activo: false },
      ],
    });
    const res = await publica(`/iglesias/${iglesia.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tiposEspacio).toEqual([{ id: expect.any(String), clase: 'CRIPTA' }]);
  });
});
