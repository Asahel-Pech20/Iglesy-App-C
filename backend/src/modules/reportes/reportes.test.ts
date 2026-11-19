import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { ROLES } from '../../config/permisos';
import { aExcel } from '../../lib/exportadores/excel';
import { aPdf } from '../../lib/exportadores/pdf';
import {
  type ContextoReporte,
  formatearCelda,
  MAX_FILAS_PDF,
  type Reporte,
} from '../../lib/exportadores/reporte';
import { prisma } from '../../lib/prisma';
import { loginComo } from '../../test/helpers';
import { etiquetaPeriodo } from './reportes.service';

let app: ReturnType<typeof crearApp>;
let admin: Awaited<ReturnType<typeof loginComo>>;
beforeEach(async () => {
  app = crearApp();
  admin = await loginComo('ADMIN_IGLESIA');
});

/** Pide un reporte; con formato pdf/xlsx devuelve el cuerpo como Buffer. */
function pedir(url: string, auth = admin.auth) {
  return request(app)
    .get(`/api/v1${url}`)
    .set('Authorization', auth)
    .buffer(true)
    .parse((res, callback) => {
      const partes: Buffer[] = [];
      res.on('data', (parte: Buffer) => partes.push(parte));
      res.on('end', () => {
        const cuerpo = Buffer.concat(partes);
        const esJson = String(res.headers['content-type']).includes('json');
        callback(null, esJson ? JSON.parse(cuerpo.toString('utf8')) : cuerpo);
      });
    });
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function leerExcel(buffer: Buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  return libro;
}

// 1 de enero del año en curso: nunca es futura y cuenta como "alta del año" sin depender de la fecha de ejecución
const INGRESO = `${new Date().getUTCFullYear()}-01-01`;

function miembro(nombre: string, apellidos: string, activo = true) {
  return prisma.miembro.create({
    data: {
      nombre,
      apellidos,
      email: `${nombre.toLowerCase()}@correo.mx`,
      fechaIngreso: new Date(`${INGRESO}T00:00:00.000Z`),
      activo,
    },
  });
}

async function escenario() {
  const [ana, beto, carla] = await Promise.all([
    miembro('Ana', 'Núñez'),
    miembro('Beto', 'Álvarez'),
    miembro('Carla', 'Inactiva', false),
  ]);
  const jovenes = await prisma.ministerio.create({ data: { nombre: 'Jóvenes' } });
  const musica = await prisma.ministerio.create({ data: { nombre: 'Música' } });
  await prisma.miembroMinisterio.createMany({
    data: [
      { miembroId: ana.id, ministerioId: jovenes.id },
      { miembroId: beto.id, ministerioId: musica.id },
    ],
  });
  const evento = (titulo: string, ministerioId: string | null, fechaInicio: string) =>
    prisma.evento.create({
      data: {
        titulo,
        tipo: 'RELIGIOSO',
        categoria: 'REUNION',
        lugar: 'Salón',
        fechaInicio: new Date(fechaInicio),
        estado: 'REALIZADO',
        ministerioId,
        creadoPorId: admin.usuario.id,
      },
    });
  const reunionJovenes = await evento('Reunión de jóvenes', jovenes.id, '2026-09-05T23:00:00.000Z');
  const ensayo = await evento('Ensayo', musica.id, '2026-09-12T23:00:00.000Z');
  await prisma.asistencia.createMany({
    data: [
      {
        eventoId: reunionJovenes.id,
        miembroId: ana.id,
        presente: true,
        registradoPorId: admin.usuario.id,
      },
      {
        eventoId: reunionJovenes.id,
        miembroId: beto.id,
        presente: false,
        registradoPorId: admin.usuario.id,
      },
      {
        eventoId: ensayo.id,
        miembroId: beto.id,
        presente: true,
        registradoPorId: admin.usuario.id,
      },
    ],
  });
  await prisma.donacion.createMany({
    data: [
      {
        fecha: new Date('2026-09-01T00:00:00.000Z'),
        monto: '1000.00',
        concepto: 'DIEZMO',
        metodo: 'TRANSFERENCIA',
        miembroId: ana.id,
        registradoPorId: admin.usuario.id,
      },
      {
        fecha: new Date('2026-09-20T00:00:00.000Z'),
        monto: '250.50',
        concepto: 'OTRO',
        conceptoDetalle: 'Rifa',
        metodo: 'EFECTIVO',
        anonima: true,
        registradoPorId: admin.usuario.id,
      },
      {
        fecha: new Date('2026-09-21T00:00:00.000Z'),
        monto: '5000.00',
        concepto: 'OFRENDA',
        metodo: 'EFECTIVO',
        anonima: true,
        anulada: true,
        registradoPorId: admin.usuario.id,
      },
    ],
  });
  return { ana, beto, carla, jovenes, musica, reunionJovenes, ensayo };
}

describe('exportadores (B4-09)', () => {
  const ctx: ContextoReporte = {
    nombreIglesia: 'Iglesia Ñandú',
    moneda: 'MXN',
    zonaHoraria: 'America/Mexico_City',
    logo: null,
  };
  const reporte: Reporte = {
    tipo: 'ingresos',
    titulo: 'Reporte de ingresos',
    filtros: [{ etiqueta: 'Desde', valor: '2026-09-01', tipo: 'fecha' }],
    resumen: [{ etiqueta: 'Total', valor: '1250.50', tipo: 'moneda' }],
    secciones: [
      {
        titulo: 'Detalle: año/mes',
        columnas: [
          { clave: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
          { clave: 'donante', titulo: 'Donante' },
          { clave: 'monto', titulo: 'Monto', tipo: 'moneda' },
        ],
        filas: [
          { fecha: '2026-09-01', donante: 'Núñez, José', monto: '1000.00' },
          { fecha: '2026-09-20', donante: 'Anónimo', monto: '250.50' },
        ],
        totales: { donante: 'Total', monto: '1250.50' },
      },
    ],
    generadoEn: '2026-10-30T18:00:00.000Z',
    generadoPor: 'Tesorería',
  };

  it('formatea celdas como el frontend (dd/MM/yyyy, moneda es-MX, porcentaje)', () => {
    expect(formatearCelda('2026-09-01', 'fecha', ctx)).toBe('01/09/2026');
    expect(formatearCelda('2026-10-30T18:00:00.000Z', 'fechaHora', ctx)).toBe('30/10/2026 12:00');
    expect(formatearCelda('1250.5', 'moneda', ctx)).toBe('$1,250.50');
    expect(formatearCelda(87.5, 'porcentaje', ctx)).toBe('87.5 %');
    expect(formatearCelda(null, 'texto', ctx)).toBe('—');
  });

  it('genera un PDF válido con varias páginas', async () => {
    const muchas = {
      ...reporte.secciones[0]!,
      filas: Array.from({ length: 120 }, () => reporte.secciones[0]!.filas[0]!),
    };
    const pdf = await aPdf({ ...reporte, secciones: [muchas] }, ctx);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });

  it('genera un Excel con encabezado, tipos reales, totales y nombre de hoja válido', async () => {
    const libro = await leerExcel(await aExcel(reporte, ctx));
    const hoja = libro.worksheets[0]!;
    expect(hoja.name).toBe('Detalle año mes');
    expect(String(hoja.getCell('A1').value)).toBe('Iglesia Ñandú — Reporte de ingresos');
    const valores = hoja
      .getSheetValues()
      .filter(Boolean)
      .map((f) => (f as unknown[]).slice(1));
    const encabezado = valores.findIndex((f) => f[0] === 'Fecha');
    expect(valores[encabezado]).toEqual(['Fecha', 'Donante', 'Monto (MXN)']);
    expect(valores[encabezado + 1]?.[0]).toBeInstanceOf(Date);
    expect(valores[encabezado + 1]?.[2]).toBe(1000);
    expect(valores[encabezado + 3]).toEqual([undefined, 'Total', 1250.5]);
  });
});

describe('GET /reportes/ingresos (B4-10)', () => {
  it('JSON con resumen agrupado y detalle; anónimas como "Anónimo"; anuladas fuera', async () => {
    await escenario();
    const res = await pedir(
      '/reportes/ingresos?desde=2026-09-01&hasta=2026-09-30&agrupar=concepto',
    );
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r).toMatchObject({ tipo: 'ingresos', generadoPor: admin.usuario.nombre });
    expect(r.resumen[0]).toEqual({ etiqueta: 'Total', valor: '1250.50', tipo: 'moneda' });
    const [grupos, detalle] = r.secciones;
    expect(grupos.filas).toContainEqual({ grupo: 'Diezmo', cantidad: 1, total: '1000.00' });
    expect(detalle.filas.map((f: { donante: string }) => f.donante)).toEqual([
      'Núñez, Ana',
      'Anónimo',
    ]);
    expect(detalle.filas[1].concepto).toBe('Otro — Rifa');
    expect(detalle.totales.monto).toBe('1250.50');
  });

  it('descarga PDF y Excel con nombre reporte-ingresos-<fecha>', async () => {
    await escenario();
    const pdf = await pedir('/reportes/ingresos?desde=2026-09-01&hasta=2026-09-30&formato=pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toMatch(
      /^attachment; filename="reporte-ingresos-\d{4}-\d{2}-\d{2}\.pdf"$/,
    );
    expect(pdf.headers['access-control-expose-headers']).toContain('Content-Disposition');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const xlsx = await pedir('/reportes/ingresos?desde=2026-09-01&hasta=2026-09-30&formato=xlsx');
    expect(xlsx.headers['content-type']).toBe(XLSX);
    expect(xlsx.headers['content-disposition']).toMatch(/\.xlsx"$/);
    const libro = await leerExcel(xlsx.body as Buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual([
      'Resumen por mes',
      'Detalle de aportaciones',
    ]);
  });

  it('SECRETARIO y COORDINADOR → 403; PASTOR y TESORERO → 200', async () => {
    for (const rol of ['SECRETARIO', 'COORDINADOR'] as const) {
      expect((await pedir('/reportes/ingresos', (await loginComo(rol)).auth)).status).toBe(403);
    }
    for (const rol of ['PASTOR', 'TESORERO'] as const) {
      expect((await pedir('/reportes/ingresos', (await loginComo(rol)).auth)).status).toBe(200);
    }
  });

  it('formato o agrupación inválidos → 400; sin token → 401', async () => {
    expect((await pedir('/reportes/ingresos?formato=docx')).status).toBe(400);
    expect((await pedir('/reportes/ingresos?agrupar=anio')).status).toBe(400);
    expect((await request(app).get('/api/v1/reportes/ingresos')).status).toBe(401);
  });
});

describe('GET /reportes/miembros (B4-11)', () => {
  it('listado con ministerios y totales (activos, inactivos, altas del año)', async () => {
    await escenario();
    const res = await pedir('/reportes/miembros?estado=todos');
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.resumen.map((d: { valor: number }) => d.valor)).toEqual([3, 2, 1, 3]);
    expect(r.secciones[0].filas[0]).toMatchObject({
      nombre: 'Álvarez, Beto',
      estado: 'Activo',
      ministerios: 'Música',
      fechaIngreso: INGRESO,
    });
  });

  it('por defecto solo activos; COORDINADOR solo ve integrantes de sus ministerios', async () => {
    const { jovenes } = await escenario();
    expect((await pedir('/reportes/miembros')).body.data.secciones[0].filas).toHaveLength(2);
    const coordinador = await loginComo('COORDINADOR');
    await prisma.ministerioCoordinador.create({
      data: { ministerioId: jovenes.id, usuarioId: coordinador.usuario.id },
    });
    const filas = (await pedir('/reportes/miembros', coordinador.auth)).body.data.secciones[0]
      .filas;
    expect(filas.map((f: { nombre: string }) => f.nombre)).toEqual(['Núñez, Ana']);
  });

  it('TESORERO → 403; estado inválido → 400', async () => {
    expect((await pedir('/reportes/miembros', (await loginComo('TESORERO')).auth)).status).toBe(
      403,
    );
    expect((await pedir('/reportes/miembros?estado=otro')).status).toBe(400);
  });

  it('descarga en Excel', async () => {
    await escenario();
    const res = await pedir('/reportes/miembros?formato=xlsx');
    expect(res.status).toBe(200);
    const hoja = (await leerExcel(res.body as Buffer)).worksheets[0]!;
    expect(hoja.name).toBe('Miembros');
  });
});

describe('GET /reportes/asistencia (B4-12)', () => {
  it('por evento: pase de lista con porcentaje', async () => {
    const { reunionJovenes } = await escenario();
    const res = await pedir(`/reportes/asistencia?eventoId=${reunionJovenes.id}`);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.titulo).toBe('Asistencia: Reunión de jóvenes');
    expect(r.resumen).toEqual([
      { etiqueta: 'Presentes', valor: 1, tipo: 'numero' },
      { etiqueta: 'Ausentes', valor: 1, tipo: 'numero' },
      { etiqueta: 'Asistencia', valor: 50, tipo: 'porcentaje' },
    ]);
    expect(r.secciones[0].filas.map((f: { asistencia: string }) => f.asistencia)).toEqual([
      'Ausente',
      'Presente',
    ]);
  });

  it('por periodo: resumen mensual y tabla de eventos', async () => {
    await escenario();
    const res = await pedir(
      '/reportes/asistencia?desde=2026-08-01&hasta=2026-09-30&periodo=mensual',
    );
    const [serie, eventos] = res.body.data.secciones;
    expect(serie.filas).toEqual([
      { periodo: 'agosto de 2026', eventos: 0, presentes: 0, ausentes: 0, promedioPorEvento: 0 },
      {
        periodo: 'septiembre de 2026',
        eventos: 2,
        presentes: 2,
        ausentes: 1,
        promedioPorEvento: 1,
      },
    ]);
    expect(
      eventos.filas.map((e: { evento: string; porcentaje: number }) => [e.evento, e.porcentaje]),
    ).toEqual([
      ['Reunión de jóvenes', 50],
      ['Ensayo', 100],
    ]);
  });

  it('COORDINADOR: solo eventos de sus ministerios; de otro → 403', async () => {
    const { jovenes, ensayo } = await escenario();
    const coordinador = await loginComo('COORDINADOR');
    await prisma.ministerioCoordinador.create({
      data: { ministerioId: jovenes.id, usuarioId: coordinador.usuario.id },
    });
    expect(
      (await pedir(`/reportes/asistencia?eventoId=${ensayo.id}`, coordinador.auth)).status,
    ).toBe(403);
    const res = await pedir(
      '/reportes/asistencia?desde=2026-09-01&hasta=2026-09-30',
      coordinador.auth,
    );
    expect(res.body.data.secciones[1].filas.map((e: { evento: string }) => e.evento)).toEqual([
      'Reunión de jóvenes',
    ]);
  });

  it('evento inexistente → 404; TESORERO → 403; rango > 2 años → 400', async () => {
    expect(
      (await pedir('/reportes/asistencia?eventoId=00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404);
    expect((await pedir('/reportes/asistencia', (await loginComo('TESORERO')).auth)).status).toBe(
      403,
    );
    expect((await pedir('/reportes/asistencia?desde=2022-01-01&hasta=2026-01-01')).status).toBe(
      400,
    );
  });
});

describe('GET /reportes/ministerios (B4-13)', () => {
  it('por ministerio: integrantes, coordinadores, eventos y % de asistencia', async () => {
    const { jovenes } = await escenario();
    const coordinador = await loginComo('COORDINADOR', { nombre: 'Lupita' });
    await prisma.ministerioCoordinador.create({
      data: { ministerioId: jovenes.id, usuarioId: coordinador.usuario.id },
    });
    const res = await pedir('/reportes/ministerios?desde=2026-09-01&hasta=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.body.data.secciones[0].filas).toContainEqual({
      ministerio: 'Jóvenes',
      coordinadores: 'Lupita',
      integrantes: 1,
      eventos: 1,
      presentes: 1,
      ausentes: 1,
      porcentaje: 50,
    });
  });

  it('con ministerioId: integrantes con su % de asistencia', async () => {
    const { musica } = await escenario();
    const res = await pedir(
      `/reportes/ministerios?ministerioId=${musica.id}&desde=2026-09-01&hasta=2026-09-30`,
    );
    expect(res.body.data.titulo).toBe('Participación: Música');
    expect(res.body.data.secciones[0].filas).toEqual([
      { integrante: 'Álvarez, Beto', presentes: 1, ausentes: 0, porcentaje: 100 },
    ]);
  });

  it('COORDINADOR solo ve sus ministerios; otro ministerio → 403', async () => {
    const { jovenes, musica } = await escenario();
    const coordinador = await loginComo('COORDINADOR');
    await prisma.ministerioCoordinador.create({
      data: { ministerioId: jovenes.id, usuarioId: coordinador.usuario.id },
    });
    const res = await pedir('/reportes/ministerios', coordinador.auth);
    expect(
      res.body.data.secciones[0].filas.map((f: { ministerio: string }) => f.ministerio),
    ).toEqual(['Jóvenes']);
    expect(
      (await pedir(`/reportes/ministerios?ministerioId=${musica.id}`, coordinador.auth)).status,
    ).toBe(403);
  });

  it('ministerio inexistente → 404; TESORERO → 403', async () => {
    expect(
      (await pedir('/reportes/ministerios?ministerioId=00000000-0000-4000-8000-000000000000'))
        .status,
    ).toBe(404);
    expect((await pedir('/reportes/ministerios', (await loginComo('TESORERO')).auth)).status).toBe(
      403,
    );
  });
});

describe('seguridad financiera (B4-14)', () => {
  const FINANCIEROS = [
    '/donaciones',
    '/donaciones/resumen',
    '/donaciones/resumen-mensual',
    '/reportes/ingresos',
    '/reportes/ingresos?formato=pdf',
  ];

  it.each(ROLES.filter((rol) => rol !== 'COORDINACION'))(
    '%s: 403 en endpoints financieros y sin "ingresos" en el dashboard si no tiene donaciones:leer',
    async (rol) => {
      const { auth } = await loginComo(rol);
      const autorizado = ['ADMIN_IGLESIA', 'PASTOR', 'TESORERO'].includes(rol);
      for (const url of FINANCIEROS) {
        expect((await pedir(url, auth)).status, `${rol} ${url}`).toBe(autorizado ? 200 : 403);
      }
      const dashboard = await pedir('/dashboard', auth);
      expect(Object.hasOwn(dashboard.body.data, 'ingresos')).toBe(autorizado);
    },
  );

  it('COORDINACION: 403 en los endpoints financieros y en el dashboard', async () => {
    const { auth } = await loginComo('COORDINACION');
    for (const url of [...FINANCIEROS, '/dashboard']) {
      expect((await pedir(url, auth)).status, url).toBe(403);
    }
  });

  it(`PDF con más de ${MAX_FILAS_PDF} filas → 422`, async () => {
    const filas = Array.from({ length: MAX_FILAS_PDF + 1 }, (_, i) => ({
      fecha: new Date('2026-09-01T00:00:00.000Z'),
      monto: '1.00',
      concepto: 'OFRENDA' as const,
      metodo: 'EFECTIVO' as const,
      anonima: true,
      registradoPorId: admin.usuario.id,
      notas: String(i),
    }));
    await prisma.donacion.createMany({ data: filas });
    const res = await pedir(
      '/reportes/ingresos?desde=2026-09-01&hasta=2026-09-01&agrupar=dia&formato=pdf',
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
  });
});

describe('etiquetaPeriodo', () => {
  it('traduce claves de periodo, día y enums', () => {
    expect(etiquetaPeriodo('2026-W07')).toBe('Semana 7 de 2026');
    expect(etiquetaPeriodo('2026-10')).toBe('octubre de 2026');
    expect(etiquetaPeriodo('2026-10-30')).toBe('30/10/2026');
    expect(etiquetaPeriodo('DONACION_ESPECIAL')).toBe('Donación especial');
    expect(etiquetaPeriodo('TRANSFERENCIA')).toBe('Transferencia');
  });
});
