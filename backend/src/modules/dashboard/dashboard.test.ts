import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { ROLES } from '../../config/permisos';
import { prisma } from '../../lib/prisma';
import { loginComo } from '../../test/helpers';
import { hoyIglesia } from '../miembros/miembros.service';
import { crearCacheDashboard } from './dashboard.service';

let app: ReturnType<typeof crearApp>;
beforeEach(() => {
  app = crearApp();
});

const get = (auth: string) => request(app).get('/api/v1/dashboard').set('Authorization', auth);

const DIA = 86_400_000;

async function datosDePrueba(usuarioId: string) {
  const hoy = await hoyIglesia();
  const [ana, beto] = await Promise.all(
    ['Ana', 'Beto'].map((nombre) =>
      prisma.miembro.create({
        data: { nombre, apellidos: 'Pérez', fechaIngreso: new Date(`${hoy}T00:00:00.000Z`) },
      }),
    ),
  );
  await prisma.miembro.create({
    data: {
      nombre: 'Inactivo',
      apellidos: 'Ruiz',
      fechaIngreso: new Date('2020-01-01T00:00:00.000Z'),
      activo: false,
    },
  });
  const ministerio = await prisma.ministerio.create({ data: { nombre: 'Jóvenes' } });
  await prisma.miembroMinisterio.create({
    data: { miembroId: ana!.id, ministerioId: ministerio.id },
  });
  // Evento de hace un minuto (mes y semana actuales) con un presente y un ausente
  const evento = await prisma.evento.create({
    data: {
      titulo: 'Culto',
      tipo: 'RELIGIOSO',
      categoria: 'CULTO',
      lugar: 'Templo',
      fechaInicio: new Date(Date.now() - 60 * 1000),
      creadoPorId: usuarioId,
    },
  });
  await prisma.asistencia.createMany({
    data: [
      { eventoId: evento.id, miembroId: ana!.id, presente: true, registradoPorId: usuarioId },
      { eventoId: evento.id, miembroId: beto!.id, presente: false, registradoPorId: usuarioId },
    ],
  });
  await prisma.evento.create({
    data: {
      titulo: 'Ensayo',
      tipo: 'RELIGIOSO',
      categoria: 'ACTIVIDAD',
      lugar: 'Salón',
      fechaInicio: new Date(Date.now() + 3 * DIA),
      creadoPorId: usuarioId,
    },
  });
  await prisma.anuncio.create({
    data: {
      titulo: 'Aviso importante',
      contenido: 'Texto',
      prioridad: 'IMPORTANTE',
      fechaPublicacion: new Date(Date.now() - DIA),
      autorId: usuarioId,
    },
  });
  await prisma.donacion.createMany({
    data: [
      {
        fecha: new Date(`${hoy}T00:00:00.000Z`),
        monto: '150.50',
        concepto: 'OFRENDA',
        metodo: 'EFECTIVO',
        anonima: true,
        registradoPorId: usuarioId,
      },
      {
        fecha: new Date(`${hoy}T00:00:00.000Z`),
        monto: '999.00',
        concepto: 'OFRENDA',
        metodo: 'EFECTIVO',
        anonima: true,
        anulada: true,
        registradoPorId: usuarioId,
      },
    ],
  });
  return { hoy, ana: ana!, beto: beto!, evento };
}

describe('GET /dashboard (B4-07)', () => {
  it('devuelve los indicadores, las gráficas y los ingresos del mes para ADMIN_IGLESIA', async () => {
    const admin = await loginComo('ADMIN_IGLESIA');
    const { hoy } = await datosDePrueba(admin.usuario.id);
    const res = await get(admin.auth);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({
      miembrosActivos: 2,
      totalMinisterios: 1,
      asistenciasRegistradas: { mesActual: 1, semanaActual: 1 },
    });
    expect(d.eventosProximos.map((e: { titulo: string }) => e.titulo)).toEqual(['Ensayo']);
    expect(d.anunciosImportantes.map((a: { titulo: string }) => a.titulo)).toEqual([
      'Aviso importante',
    ]);
    expect(d.graficas.asistenciaSemanal).toHaveLength(12);
    expect(d.graficas.asistenciaSemanal.at(-1)).toMatchObject({
      presentes: 1,
      ausentes: 1,
      eventos: 1,
    });
    expect(d.graficas.miembrosPorMinisterio).toEqual([
      { ministerioId: expect.any(String), ministerio: 'Jóvenes', total: 1 },
    ]);
    expect(d.graficas.altasMiembrosPorMes).toHaveLength(12);
    expect(d.graficas.altasMiembrosPorMes.at(-1)).toEqual({ mes: hoy.slice(0, 7), total: 2 });
    // La anulada no suma
    expect(d.ingresos).toMatchObject({
      mesActual: '150.50',
      mesAnterior: '0.00',
      variacionPorcentual: null,
    });
    expect(d.ingresos.porMes).toHaveLength(12);
    expect(d.ingresos.porMes.at(-1)).toEqual({
      mes: hoy.slice(0, 7),
      total: '150.50',
      cantidad: 1,
    });
  });

  // El dashboard es de una iglesia: la Coordinación nacional no lo tiene
  const ROLES_DE_IGLESIA = ROLES.filter((rol) => rol !== 'COORDINACION');

  it('COORDINACION: 403 (el dashboard es de cada iglesia)', async () => {
    const { auth } = await loginComo('COORDINACION');
    expect((await get(auth)).status).toBe(403);
  });

  it.each(ROLES_DE_IGLESIA)(
    '%s: la clave ingresos solo existe si tiene donaciones:leer',
    async (rol) => {
      const { auth } = await loginComo(rol);
      const res = await get(auth);
      expect(res.status).toBe(200);
      const conIngresos = ['ADMIN_IGLESIA', 'PASTOR', 'TESORERO'].includes(rol);
      expect(Object.hasOwn(res.body.data, 'ingresos')).toBe(conIngresos);
      // Omitida, no null ni 0 (AGENTS.md §1, regla 4)
      if (!conIngresos) expect(JSON.stringify(res.body)).not.toContain('"ingresos"');
    },
  );

  it('sin token → 401', async () => {
    expect((await request(app).get('/api/v1/dashboard')).status).toBe(401);
  });

  it('responde en menos de 500 ms', async () => {
    const admin = await loginComo('ADMIN_IGLESIA');
    await datosDePrueba(admin.usuario.id);
    await get(admin.auth); // calienta conexiones
    const inicio = performance.now();
    await crearCacheDashboard(0)('ADMIN_IGLESIA');
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});

describe('cache del dashboard (B4-08)', () => {
  it('reutiliza la respuesta mientras los datos no cambian', async () => {
    const obtener = crearCacheDashboard();
    const primera = await obtener('ADMIN_IGLESIA');
    expect(await obtener('ADMIN_IGLESIA')).toBe(primera);
    // Otra vista (sin ingresos) no comparte la entrada
    const sinIngresos = await obtener('SECRETARIO');
    expect(sinIngresos).not.toBe(primera);
    expect(Object.hasOwn(sinIngresos, 'ingresos')).toBe(false);
  });

  it('se invalida al registrar asistencia y al crear o anular una aportación', async () => {
    const admin = await loginComo('ADMIN_IGLESIA');
    const { hoy, evento, ana } = await datosDePrueba(admin.usuario.id);
    const obtener = crearCacheDashboard();
    expect((await obtener('ADMIN_IGLESIA')).asistenciasRegistradas.mesActual).toBe(1);

    await prisma.asistencia.update({
      where: { eventoId_miembroId: { eventoId: evento.id, miembroId: ana.id } },
      data: { presente: false },
    });
    expect((await obtener('ADMIN_IGLESIA')).asistenciasRegistradas.mesActual).toBe(0);

    const nueva = await prisma.donacion.create({
      data: {
        fecha: new Date(`${hoy}T00:00:00.000Z`),
        monto: '49.50',
        concepto: 'DIEZMO',
        metodo: 'EFECTIVO',
        anonima: true,
        registradoPorId: admin.usuario.id,
      },
    });
    expect((await obtener('ADMIN_IGLESIA')).ingresos?.mesActual).toBe('200.00');

    await prisma.donacion.update({ where: { id: nueva.id }, data: { anulada: true } });
    expect((await obtener('ADMIN_IGLESIA')).ingresos?.mesActual).toBe('150.50');
  });

  it('caduca a los 60 s aunque los datos no cambien', async () => {
    const obtener = crearCacheDashboard(-1);
    const primera = await obtener('ADMIN_IGLESIA');
    expect(await obtener('ADMIN_IGLESIA')).not.toBe(primera);
  });
});
