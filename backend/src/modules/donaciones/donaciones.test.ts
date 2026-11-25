import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import { iglesiaDePrueba, prisma } from '../../test/bd';
import { deOtraIglesia, loginComo } from '../../test/helpers';
import { hoyIglesia } from '../miembros/miembros.service';
import * as donacionesService from './donaciones.service';

let app: ReturnType<typeof crearApp>;
let tesorero: Awaited<ReturnType<typeof loginComo>>;
beforeEach(async () => {
  app = crearApp();
  tesorero = await loginComo('TESORERO');
});

const api = () => ({
  get: (url: string, auth = tesorero.auth) =>
    request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, body?: object, auth = tesorero.auth) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(body),
  patch: (url: string, body: object, auth = tesorero.auth) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(body),
});

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';

async function crearMiembro(datos: { nombre?: string; activo?: boolean } = {}) {
  return prisma.miembro.create({
    data: {
      iglesiaId: await iglesiaDePrueba(),
      nombre: datos.nombre ?? 'Ana',
      apellidos: 'López',
      fechaIngreso: new Date('2025-01-10T00:00:00.000Z'),
      activo: datos.activo ?? true,
    },
  });
}

async function crearDonacion(datos: {
  fecha: string;
  monto: string;
  concepto?: 'DIEZMO' | 'OFRENDA' | 'OTRO';
  metodo?: 'EFECTIVO' | 'TRANSFERENCIA';
  miembroId?: string;
  anulada?: boolean;
}) {
  return prisma.donacion.create({
    data: {
      iglesiaId: await iglesiaDePrueba(),
      fecha: new Date(`${datos.fecha}T00:00:00.000Z`),
      monto: datos.monto,
      concepto: datos.concepto ?? 'OFRENDA',
      metodo: datos.metodo ?? 'EFECTIVO',
      miembroId: datos.miembroId ?? null,
      anonima: !datos.miembroId,
      anulada: datos.anulada ?? false,
      registradoPorId: tesorero.usuario.id,
    },
  });
}

const base = { fecha: '2026-10-01', monto: '1500.00', concepto: 'DIEZMO', metodo: 'EFECTIVO' };

describe('POST /donaciones (B4-01)', () => {
  it('registra una aportación identificada con el usuario actual como registrador', async () => {
    const miembro = await crearMiembro();
    const res = await api().post('/donaciones', { ...base, miembroId: miembro.id });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      fecha: '2026-10-01',
      monto: '1500.00',
      concepto: 'DIEZMO',
      anonima: false,
      anulada: false,
      miembro: { id: miembro.id, nombre: 'Ana' },
      registradoPor: { id: tesorero.usuario.id },
    });
  });

  it('sin donante se guarda como anónima', async () => {
    const res = await api().post('/donaciones', { ...base, anonima: false });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ anonima: true, miembro: null });
  });

  it('acepta el monto como number pero responde string con 2 decimales', async () => {
    const res = await api().post('/donaciones', { ...base, monto: 250.5 });
    expect(res.status).toBe(201);
    expect(res.body.data.monto).toBe('250.50');
  });

  it('anónima con donante → 400', async () => {
    const miembro = await crearMiembro();
    const res = await api().post('/donaciones', { ...base, anonima: true, miembroId: miembro.id });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'miembroId' })]),
    );
  });

  it.each([
    ['monto cero', { monto: '0' }],
    ['monto con 3 decimales', { monto: '10.555' }],
    ['monto negativo', { monto: '-5' }],
    ['concepto OTRO sin detalle', { concepto: 'OTRO' }],
    ['método inválido', { metodo: 'BITCOIN' }],
    ['campo desconocido', { extra: 1 }],
  ])('%s → 400', async (_caso, cambios) => {
    const res = await api().post('/donaciones', { ...base, ...cambios });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('fecha futura → 400', async () => {
    const hoy = await hoyIglesia();
    const manana = new Date(Date.parse(`${hoy}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const res = await api().post('/donaciones', { ...base, fecha: manana });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].campo).toBe('fecha');
  });

  it('donante inactivo o inexistente → 422', async () => {
    const inactivo = await crearMiembro({ activo: false });
    for (const miembroId of [inactivo.id, ID_INEXISTENTE]) {
      const res = await api().post('/donaciones', { ...base, miembroId });
      expect(res.status).toBe(422);
    }
  });

  it('PASTOR (solo lectura), SECRETARIO y COORDINADOR → 403; sin token → 401', async () => {
    for (const rol of ['PASTOR', 'SECRETARIO', 'COORDINADOR'] as const) {
      const { auth } = await loginComo(rol);
      expect((await api().post('/donaciones', base, auth)).status).toBe(403);
    }
    expect((await request(app).post('/api/v1/donaciones').send(base)).status).toBe(401);
  });
});

describe('GET /donaciones (B4-02)', () => {
  it('lista por fecha desc, excluye anuladas y suma el filtro en meta.totalMonto', async () => {
    await crearDonacion({ fecha: '2026-09-01', monto: '100.00' });
    await crearDonacion({ fecha: '2026-09-15', monto: '50.25' });
    await crearDonacion({ fecha: '2026-09-20', monto: '999.00', anulada: true });
    const res = await api().get('/donaciones?desde=2026-09-01&hasta=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { fecha: string }) => d.fecha)).toEqual([
      '2026-09-15',
      '2026-09-01',
    ]);
    expect(res.body.meta).toMatchObject({ total: 2, totalMonto: '150.25', page: 1 });
  });

  it('incluirAnuladas muestra las anuladas pero no las suma', async () => {
    await crearDonacion({ fecha: '2026-09-01', monto: '100.00' });
    await crearDonacion({ fecha: '2026-09-02', monto: '40.00', anulada: true });
    const res = await api().get('/donaciones?incluirAnuladas=true');
    expect(res.body.meta).toMatchObject({ total: 2, totalMonto: '100.00' });
  });

  it('filtra por concepto, método, donante y anónimas', async () => {
    const miembro = await crearMiembro();
    await crearDonacion({
      fecha: '2026-09-01',
      monto: '10.00',
      concepto: 'DIEZMO',
      miembroId: miembro.id,
    });
    await crearDonacion({ fecha: '2026-09-02', monto: '20.00', metodo: 'TRANSFERENCIA' });
    expect((await api().get('/donaciones?concepto=DIEZMO')).body.meta.total).toBe(1);
    expect((await api().get('/donaciones?metodo=TRANSFERENCIA')).body.meta.total).toBe(1);
    expect((await api().get(`/donaciones?miembroId=${miembro.id}`)).body.meta.total).toBe(1);
    const anonimas = await api().get('/donaciones?anonima=true');
    expect(anonimas.body.data).toHaveLength(1);
    expect(anonimas.body.data[0].monto).toBe('20.00');
  });

  it('PASTOR puede leer; SECRETARIO y COORDINADOR → 403', async () => {
    expect((await api().get('/donaciones', (await loginComo('PASTOR')).auth)).status).toBe(200);
    for (const rol of ['SECRETARIO', 'COORDINADOR'] as const) {
      expect((await api().get('/donaciones', (await loginComo(rol)).auth)).status).toBe(403);
    }
  });

  it('desde posterior a hasta → 400', async () => {
    expect((await api().get('/donaciones?desde=2026-10-02&hasta=2026-10-01')).status).toBe(400);
  });

  it('GET /donaciones/:id incluye la auditoría; inexistente → 404', async () => {
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '10.00' });
    const res = await api().get(`/donaciones/${donacion.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      registradoPor: { id: tesorero.usuario.id },
      actualizadoPor: null,
    });
    expect((await api().get(`/donaciones/${ID_INEXISTENTE}`)).status).toBe(404);
  });
});

describe('PATCH /donaciones/:id (B4-03)', () => {
  it('edita y guarda quién actualizó', async () => {
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '10.00' });
    const res = await api().patch(`/donaciones/${donacion.id}`, {
      monto: '12.50',
      notas: 'Corrección',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      monto: '12.50',
      notas: 'Corrección',
      actualizadoPor: { id: tesorero.usuario.id },
    });
  });

  it('asignar donante la vuelve identificada; marcar anónima quita el donante', async () => {
    const miembro = await crearMiembro();
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '10.00' });
    const identificada = await api().patch(`/donaciones/${donacion.id}`, { miembroId: miembro.id });
    expect(identificada.body.data).toMatchObject({ anonima: false, miembro: { id: miembro.id } });
    const anonima = await api().patch(`/donaciones/${donacion.id}`, { anonima: true });
    expect(anonima.body.data).toMatchObject({ anonima: true, miembro: null });
  });

  it('mismas reglas de anonimato y de concepto OTRO → 400', async () => {
    const miembro = await crearMiembro();
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '10.00' });
    const r1 = await api().patch(`/donaciones/${donacion.id}`, {
      anonima: true,
      miembroId: miembro.id,
    });
    expect(r1.status).toBe(400);
    const r2 = await api().patch(`/donaciones/${donacion.id}`, { anonima: false });
    expect(r2.status).toBe(400);
    const r3 = await api().patch(`/donaciones/${donacion.id}`, { concepto: 'OTRO' });
    expect(r3.status).toBe(400);
    const r4 = await api().patch(`/donaciones/${donacion.id}`, {
      concepto: 'OTRO',
      conceptoDetalle: 'Rifa',
    });
    expect(r4.status).toBe(200);
  });

  it('editar una anulada → 422; PASTOR → 403', async () => {
    const anulada = await crearDonacion({ fecha: '2026-09-01', monto: '10.00', anulada: true });
    expect((await api().patch(`/donaciones/${anulada.id}`, { notas: 'x' })).status).toBe(422);
    const { auth } = await loginComo('PASTOR');
    expect((await api().patch(`/donaciones/${anulada.id}`, { notas: 'x' }, auth)).status).toBe(403);
  });
});

describe('PATCH /donaciones/:id/anular (B4-04)', () => {
  it('anula con motivo, deja auditoría y deja de sumar', async () => {
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '80.00' });
    const res = await api().patch(`/donaciones/${donacion.id}/anular`, {
      motivo: 'Registro duplicado',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      anulada: true,
      motivoAnulacion: 'Registro duplicado',
      actualizadoPor: { id: tesorero.usuario.id },
    });
    expect(res.body.data.anuladaEn).not.toBeNull();
    const resumen = await api().get('/donaciones/resumen?desde=2026-09-01&hasta=2026-09-30');
    expect(resumen.body.data.total).toBe('0.00');
  });

  it('ya anulada → 422; motivo corto → 400; no existe DELETE', async () => {
    const donacion = await crearDonacion({ fecha: '2026-09-01', monto: '80.00', anulada: true });
    expect(
      (await api().patch(`/donaciones/${donacion.id}/anular`, { motivo: 'Otra vez' })).status,
    ).toBe(422);
    expect((await api().patch(`/donaciones/${donacion.id}/anular`, { motivo: 'no' })).status).toBe(
      400,
    );
    const borrar = await request(app)
      .delete(`/api/v1/donaciones/${donacion.id}`)
      .set('Authorization', tesorero.auth);
    expect(borrar.status).toBe(404);
  });
});

describe('GET /donaciones/resumen (B4-05)', () => {
  it('suma exacta en decimal (0.10 + 0.20 = 0.30)', async () => {
    await crearDonacion({ fecha: '2026-09-01', monto: '0.10' });
    await crearDonacion({ fecha: '2026-09-01', monto: '0.20' });
    const res = await api().get(
      '/donaciones/resumen?desde=2026-09-01&hasta=2026-09-01&agrupar=dia',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: '0.30', cantidad: 2 });
    expect(res.body.data.grupos).toEqual([{ clave: '2026-09-01', total: '0.30', cantidad: 2 }]);
  });

  it('serie mensual continua con meses en cero', async () => {
    await crearDonacion({ fecha: '2026-07-10', monto: '100.00' });
    await crearDonacion({ fecha: '2026-09-05', monto: '50.00' });
    const res = await api().get(
      '/donaciones/resumen?desde=2026-07-01&hasta=2026-09-30&agrupar=mes',
    );
    expect(res.body.data.grupos).toEqual([
      { clave: '2026-07', total: '100.00', cantidad: 1 },
      { clave: '2026-08', total: '0.00', cantidad: 0 },
      { clave: '2026-09', total: '50.00', cantidad: 1 },
    ]);
  });

  it('agrupa por semana ISO, concepto y método', async () => {
    await crearDonacion({ fecha: '2026-10-05', monto: '10.00', concepto: 'DIEZMO' });
    await crearDonacion({ fecha: '2026-10-11', monto: '5.00', metodo: 'TRANSFERENCIA' });
    const semanas = await api().get(
      '/donaciones/resumen?desde=2026-10-05&hasta=2026-10-12&agrupar=semana',
    );
    expect(semanas.body.data.grupos).toEqual([
      { clave: '2026-W41', total: '15.00', cantidad: 2 },
      { clave: '2026-W42', total: '0.00', cantidad: 0 },
    ]);
    const conceptos = await api().get(
      '/donaciones/resumen?desde=2026-10-01&hasta=2026-10-31&agrupar=concepto',
    );
    expect(conceptos.body.data.grupos).toHaveLength(5);
    expect(conceptos.body.data.grupos[0]).toEqual({ clave: 'DIEZMO', total: '10.00', cantidad: 1 });
    const metodos = await api().get(
      '/donaciones/resumen?desde=2026-10-01&hasta=2026-10-31&agrupar=metodo',
    );
    expect(
      metodos.body.data.grupos.find((g: { clave: string }) => g.clave === 'TRANSFERENCIA'),
    ).toEqual({
      clave: 'TRANSFERENCIA',
      total: '5.00',
      cantidad: 1,
    });
  });

  it('rango de más de 2 años o agrupación inválida → 400; SECRETARIO → 403', async () => {
    expect((await api().get('/donaciones/resumen?desde=2023-01-01&hasta=2026-01-01')).status).toBe(
      400,
    );
    expect((await api().get('/donaciones/resumen?agrupar=anio')).status).toBe(400);
    const { auth } = await loginComo('SECRETARIO');
    expect((await api().get('/donaciones/resumen', auth)).status).toBe(403);
  });
});

describe('GET /donaciones/resumen-mensual (B4-06)', () => {
  it('total, variación contra el mes anterior, desgloses y anónimas vs. identificadas', async () => {
    const miembro = await crearMiembro();
    await crearDonacion({ fecha: '2026-08-15', monto: '200.00' });
    await crearDonacion({
      fecha: '2026-09-01',
      monto: '200.00',
      concepto: 'DIEZMO',
      miembroId: miembro.id,
    });
    await crearDonacion({ fecha: '2026-09-30', monto: '100.00', metodo: 'TRANSFERENCIA' });
    const res = await api().get('/donaciones/resumen-mensual?anio=2026&mes=9');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      anio: 2026,
      mes: 9,
      total: '300.00',
      cantidad: 2,
      mesAnterior: { anio: 2026, mes: 8, total: '200.00' },
      variacionPorcentual: 50,
      anonimas: { cantidad: 1, total: '100.00' },
      identificadas: { cantidad: 1, total: '200.00' },
    });
    expect(res.body.data.porConcepto).toContainEqual({
      clave: 'DIEZMO',
      total: '200.00',
      cantidad: 1,
    });
    expect(res.body.data.porMetodo).toContainEqual({
      clave: 'TRANSFERENCIA',
      total: '100.00',
      cantidad: 1,
    });
  });

  it('mes sin datos → totales "0.00" y variación null; enero compara con diciembre', async () => {
    const res = await api().get('/donaciones/resumen-mensual?anio=2026&mes=1');
    expect(res.body.data).toMatchObject({
      total: '0.00',
      variacionPorcentual: null,
      mesAnterior: { anio: 2025, mes: 12, total: '0.00' },
    });
  });

  it('mes fuera de rango → 400', async () => {
    expect((await api().get('/donaciones/resumen-mensual?anio=2026&mes=13')).status).toBe(400);
  });
});

describe('funciones de servicio', () => {
  it('formatoMonto y variacionPorcentual no pierden precisión', () => {
    expect(donacionesService.formatoMonto(null)).toBe('0.00');
    expect(donacionesService.formatoMonto('7')).toBe('7.00');
    expect(donacionesService.variacionPorcentual('110.00', '100.00')).toBe(10);
    expect(donacionesService.variacionPorcentual('1.00', '3.00')).toBe(-66.7);
    expect(donacionesService.variacionPorcentual('5.00', '0.00')).toBeNull();
  });

  it('inicioMes y finMes', () => {
    expect(donacionesService.inicioMes('2026-03-15', 2)).toBe('2026-01-01');
    expect(donacionesService.inicioMes('2026-01-15', 1)).toBe('2025-12-01');
    expect(donacionesService.finMes('2028-02-10')).toBe('2028-02-29');
  });
});

describe('alcance por iglesia (E1-06)', () => {
  it('registrar una aportación de un miembro de otra iglesia → 422', async () => {
    const otra = await deOtraIglesia();
    const res = await api().post('/donaciones', {
      fecha: '2026-10-01',
      monto: '100.00',
      concepto: 'OFRENDA',
      metodo: 'EFECTIVO',
      miembroId: otra.miembro.id,
    });
    expect(res.status).toBe(422);
  });

  it('el listado y el resumen no incluyen aportaciones de otra iglesia', async () => {
    const otra = await deOtraIglesia();
    await prisma.donacion.create({
      data: {
        fecha: new Date('2026-10-01'),
        monto: '999.00',
        concepto: 'OFRENDA',
        metodo: 'EFECTIVO',
        anonima: true,
        registradoPorId: otra.coordinador.id,
        iglesiaId: otra.iglesiaId,
      },
    });
    expect((await api().get('/donaciones')).body.meta.total).toBe(0);
    const resumen = await api().get('/donaciones/resumen?desde=2026-10-01&hasta=2026-10-31');
    expect(resumen.body.data.total).toBe('0.00');
  });
});
