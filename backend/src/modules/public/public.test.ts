import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { iglesiaDePrueba, prisma } from '../../test/bd';
import { crearUsuario, deOtraIglesia } from '../../test/helpers';

let app: ReturnType<typeof crearApp>;
beforeEach(() => {
  app = crearApp();
});

const DIA = 86_400_000;
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

async function prepararDatos() {
  const autor = await crearUsuario('SECRETARIO', { nombre: 'Secretaria Privada' });
  // E1-06b: los datos de la cartelera son los de la iglesia (antes, la configuración única)
  await prisma.iglesia.update({
    where: { id: await iglesiaDePrueba() },
    data: { nombre: 'Iglesia Central', telefono: '9991234567' },
  });
  await prisma.horarioReunion.createMany({
    data: [
      {
        iglesiaId: await iglesiaDePrueba(),
        nombre: 'Culto dominical',
        diaSemana: 0,
        horaInicio: '10:00',
        lugar: 'Templo',
      },
      {
        iglesiaId: await iglesiaDePrueba(),
        nombre: 'Horario retirado',
        diaSemana: 3,
        horaInicio: '19:00',
        activo: false,
      },
    ],
  });
  const miembro = await prisma.miembro.create({
    data: {
      iglesiaId: await iglesiaDePrueba(),
      nombre: 'Responsable',
      apellidos: 'Oculto',
      fechaIngreso: new Date('2025-01-01'),
    },
  });
  const evento = await prisma.evento.create({
    data: {
      iglesiaId: await iglesiaDePrueba(),
      titulo: 'Concierto de alabanza',
      tipo: 'RELIGIOSO',
      categoria: 'ACTIVIDAD',
      lugar: 'Templo',
      fechaInicio: enDias(3),
      creadoPorId: autor.id,
    },
  });
  await prisma.eventoResponsable.create({ data: { eventoId: evento.id, miembroId: miembro.id } });
  await prisma.evento.create({
    data: {
      iglesiaId: await iglesiaDePrueba(),
      titulo: 'Cancelado',
      tipo: 'RELIGIOSO',
      categoria: 'CULTO',
      lugar: 'Templo',
      fechaInicio: enDias(2),
      estado: 'CANCELADO',
      creadoPorId: autor.id,
    },
  });
  await prisma.anuncio.createMany({
    data: [
      {
        iglesiaId: await iglesiaDePrueba(),
        titulo: 'Vigente',
        contenido: 'Hola',
        fechaPublicacion: enDias(-1),
        autorId: autor.id,
      },
      {
        iglesiaId: await iglesiaDePrueba(),
        titulo: 'Programado',
        contenido: 'Pronto',
        fechaPublicacion: enDias(1),
        autorId: autor.id,
      },
    ],
  });
}

describe('GET /public/cartelera (B3-15)', () => {
  it('sin sesión devuelve iglesia, horarios activos, anuncios vigentes y próximos eventos', async () => {
    await prepararDatos();
    const res = await request(app).get('/api/v1/public/cartelera');
    expect(res.status).toBe(200);
    const { iglesia, horarios, anuncios, eventosProximos } = res.body.data;
    expect(iglesia).toMatchObject({ nombre: 'Iglesia Central', telefono: '9991234567' });
    expect(horarios.map((h: { nombre: string }) => h.nombre)).toEqual(['Culto dominical']);
    expect(anuncios.map((a: { titulo: string }) => a.titulo)).toEqual(['Vigente']);
    expect(eventosProximos.map((e: { titulo: string }) => e.titulo)).toEqual([
      'Concierto de alabanza',
    ]);
  });

  it('no expone datos de miembros, usuarios ni responsables', async () => {
    await prepararDatos();
    const res = await request(app).get('/api/v1/public/cartelera');
    const texto = JSON.stringify(res.body);
    for (const prohibido of [
      'Secretaria Privada',
      'Responsable',
      'Oculto',
      'autor',
      'creadoPor',
      'responsables',
      'totalResponsables',
      'email":"secretario',
      'motivoCancelacion',
    ]) {
      expect(texto).not.toContain(prohibido);
    }
    expect(Object.keys(res.body.data.eventosProximos[0]).sort()).toEqual([
      'categoria',
      'descripcion',
      'fechaFin',
      'fechaInicio',
      'id',
      'lugar',
      'tipo',
      'titulo',
    ]);
    expect(Object.keys(res.body.data.anuncios[0]).sort()).toEqual([
      'contenido',
      'fechaExpiracion',
      'fechaPublicacion',
      'id',
      'prioridad',
      'titulo',
    ]);
  });

  it('usa una cache de 60 s', async () => {
    await prepararDatos();
    const primera = await request(app).get('/api/v1/public/cartelera');
    await prisma.anuncio.deleteMany();
    const segunda = await request(app).get('/api/v1/public/cartelera');
    expect(segunda.body).toEqual(primera.body);
  });

  it('rate limit de 60 por minuto → 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 60; i++) {
      expect((await request(app).get('/api/v1/public/cartelera')).status).toBe(200);
    }
    const res = await request(app).get('/api/v1/public/cartelera');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('cartelera e iglesia inicial (E1-06, hasta E1-06b)', () => {
  it('muestra la gestión interna de la iglesia INICIAL (la más antigua), no la de otras', async () => {
    const inicial = await iglesiaDePrueba();
    const otra = await deOtraIglesia();
    const autor = await crearUsuario('SECRETARIO');
    for (const [iglesiaId, titulo] of [
      [inicial, 'Aviso de la inicial'],
      [otra.iglesiaId, 'Aviso de otra'],
    ] as const) {
      await prisma.anuncio.create({
        data: {
          titulo,
          contenido: 'x',
          fechaPublicacion: enDias(-1),
          autorId: autor.id,
          iglesiaId,
        },
      });
      await prisma.horarioReunion.create({
        data: { nombre: titulo, diaSemana: 0, horaInicio: '10:00', iglesiaId },
      });
    }
    const res = await request(app).get('/api/v1/public/cartelera');
    expect(res.status).toBe(200);
    expect(res.body.data.anuncios.map((a: { titulo: string }) => a.titulo)).toEqual([
      'Aviso de la inicial',
    ]);
    expect(res.body.data.horarios.map((h: { nombre: string }) => h.nombre)).toEqual([
      'Aviso de la inicial',
    ]);
    // El evento de la otra iglesia (fixture) tampoco aparece
    expect(res.body.data.eventosProximos).toEqual([]);
  });

  it('sin iglesias responde con listas vacías', async () => {
    const res = await request(app).get('/api/v1/public/cartelera');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ horarios: [], anuncios: [], eventosProximos: [] });
  });
});

describe('cartelera de cada iglesia (E1-06b)', () => {
  async function iglesiaConAnuncio(nombre: string, titulo: string) {
    const otra = await deOtraIglesia();
    await prisma.iglesia.update({ where: { id: otra.iglesiaId }, data: { nombre } });
    await prisma.anuncio.create({
      data: {
        titulo,
        contenido: 'x',
        fechaPublicacion: enDias(-1),
        autorId: otra.coordinador.id,
        iglesiaId: otra.iglesiaId,
      },
    });
    return otra.iglesiaId;
  }
  const cartelera = (iglesiaId: string) =>
    request(app).get(`/api/v1/public/iglesias/${iglesiaId}/cartelera`);

  it('muestra los datos y anuncios de ESA iglesia (y la cache no los mezcla)', async () => {
    const b = await iglesiaConAnuncio('Parroquia B', 'Aviso B');
    const c = await iglesiaConAnuncio('Parroquia C', 'Aviso C');
    for (const [id, nombre, aviso] of [
      [b, 'Parroquia B', 'Aviso B'],
      [c, 'Parroquia C', 'Aviso C'],
    ] as const) {
      const res = await cartelera(id);
      expect(res.status).toBe(200);
      expect(res.body.data.iglesia.nombre).toBe(nombre);
      expect(res.body.data.anuncios.map((a: { titulo: string }) => a.titulo)).toEqual([aviso]);
    }
  });

  it('id no válido → 400; inexistente → 404; cerrada → 404', async () => {
    expect((await cartelera('no-es-uuid')).status).toBe(400);
    expect((await cartelera('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    const b = await iglesiaConAnuncio('Cerrada', 'x');
    await prisma.iglesia.update({ where: { id: b }, data: { activa: false } });
    expect((await cartelera(b)).status).toBe(404);
  });

  it('/public/cartelera es el alias de la iglesia inicial', async () => {
    const inicial = await iglesiaDePrueba();
    await prisma.iglesia.update({ where: { id: inicial }, data: { nombre: 'La inicial' } });
    await iglesiaConAnuncio('Otra', 'Aviso de otra');
    const alias = await request(app).get('/api/v1/public/cartelera');
    expect(alias.body.data.iglesia.nombre).toBe('La inicial');
    expect(alias.body.data).toEqual((await cartelera(inicial)).body.data);
  });
});
