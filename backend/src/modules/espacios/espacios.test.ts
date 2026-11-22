// Criptas, nichos, columbarios y osarios: tipos, solicitud pública con folio y clave, cotización,
// respuesta de la persona y vencimiento (RF-70–RF-80, RN-47–RN-53, CA-26–CA-29, P-24–P-27).
// La BD de pruebas se vacía antes de cada prueba (src/test/setup.ts). Cada prueba usa su propia app
// para que el límite de peticiones por IP de las rutas públicas empiece de cero.
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../test/bd';
import { hashToken } from '../../lib/seguridad';
import { crearIglesia, loginComo } from '../../test/helpers';
import { fechaVencimiento } from './dominio/vigencia-cotizacion';

const DIA = 24 * 60 * 60 * 1000;
const CLAVE = 'ABCDEFGHJK';
const ID_INEXISTENTE = '5f4b8c3e-6a5d-4a53-9a1e-0c1d2e3f4a5b';

let app: ReturnType<typeof crearApp>;
beforeEach(() => {
  app = crearApp();
});

const panel = (auth: string) => ({
  get: (url: string) => request(app).get(`/api/v1${url}`).set('Authorization', auth),
  post: (url: string, cuerpo?: object) =>
    request(app).post(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
  patch: (url: string, cuerpo?: object) =>
    request(app).patch(`/api/v1${url}`).set('Authorization', auth).send(cuerpo),
});
const publico = {
  get: (url: string) => request(app).get(`/api/v1/public${url}`),
  post: (url: string, cuerpo?: object) => request(app).post(`/api/v1/public${url}`).send(cuerpo),
};

async function escenario() {
  const iglesia = await crearIglesia({ nombre: 'Parroquia del Centro' });
  await prisma.iglesia.update({
    where: { id: iglesia.id },
    data: { telefono: '9999000000', correo: 'parroquia@ejemplo.mx' },
  });
  const admin = await loginComo('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const tipo = await prisma.tipoEspacio.create({
    data: { iglesiaId: iglesia.id, clase: 'CRIPTA' },
  });
  return { iglesia, admin, tipo };
}

let consecutivo = 0;
/** Una solicitud creada directo en la BD, con una clave conocida (para no gastar el límite de creación). */
async function solicitudDirecta(
  iglesiaId: string,
  tipoEspacioId: string,
  extra: Partial<Prisma.SolicitudEspacioUncheckedCreateInput> = {},
) {
  consecutivo += 1;
  const s = await prisma.solicitudEspacio.create({
    data: {
      folio: `ESP-2026-${String(900000 + consecutivo)}`,
      claveHash: hashToken(CLAVE),
      iglesiaId,
      tipoEspacioId,
      contactoNombre: 'Ana Pérez',
      contactoTelefono: '9991234567',
      contactoCorreo: 'ana@ejemplo.mx',
      ...extra,
    },
  });
  return s;
}

/** Una solicitud cotizada cuya cotización se emitió hace `dias` días. */
async function solicitudCotizada(iglesiaId: string, tipoEspacioId: string, dias: number) {
  const s = await solicitudDirecta(iglesiaId, tipoEspacioId, { estado: 'COTIZADA' });
  const emitidaEn = new Date(Date.now() - dias * DIA);
  await prisma.cotizacion.create({
    data: {
      solicitudId: s.id,
      monto: '1500.00',
      condiciones: 'Pago en dos partes.',
      emitidaEn,
      venceEn: fechaVencimiento(emitidaEn),
    },
  });
  return s;
}

const acceso = (s: { folio: string }, clave = CLAVE) => ({
  url: `/solicitudes-espacio/${s.folio}`,
  cuerpo: { clave },
});

// ═════════════════════ Tipos de espacio ═════════════════════

describe('tipos de espacio del panel (RF-70, RN-47)', () => {
  it('el administrador agrega un tipo, lo lista y lo desactiva sin borrarlo', async () => {
    const { iglesia, admin } = await escenario();
    const url = `/iglesias/${iglesia.id}/tipos-espacio`;
    const creado = await panel(admin.auth).post(url, { clase: 'NICHO' });
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ clase: 'NICHO', activo: true, disponible: true });

    const lista = await panel(admin.auth).get(url);
    expect(lista.body.data.map((t: { clase: string }) => t.clase)).toEqual(['CRIPTA', 'NICHO']);

    const editado = await panel(admin.auth).patch(`${url}/${creado.body.data.id}`, {
      activo: false,
    });
    expect(editado.status).toBe(200);
    expect(editado.body.data.activo).toBe(false);
    // No se borra: queda para conservar sus solicitudes
    expect(await prisma.tipoEspacio.count({ where: { iglesiaId: iglesia.id } })).toBe(2);
  });

  it('no repite una clase en la misma iglesia (409) y valida los datos (400)', async () => {
    const { iglesia, admin } = await escenario();
    const url = `/iglesias/${iglesia.id}/tipos-espacio`;
    expect((await panel(admin.auth).post(url, { clase: 'CRIPTA' })).status).toBe(409);
    expect((await panel(admin.auth).post(url, { clase: 'MAUSOLEO' })).status).toBe(400);
    expect((await panel(admin.auth).post(url, { clase: 'NICHO', precio: '10' })).status).toBe(400);
    expect((await panel(admin.auth).patch(`${url}/${ID_INEXISTENTE}`, {})).status).toBe(400);
  });

  it('un tipo de otra iglesia no se edita con la ruta propia (404)', async () => {
    const { iglesia, admin } = await escenario();
    const ajena = await crearIglesia();
    const tipoAjeno = await prisma.tipoEspacio.create({
      data: { iglesiaId: ajena.id, clase: 'OSARIO' },
    });
    const res = await panel(admin.auth).patch(
      `/iglesias/${iglesia.id}/tipos-espacio/${tipoAjeno.id}`,
      {
        activo: false,
      },
    );
    expect(res.status).toBe(404);
    expect(
      (await prisma.tipoEspacio.findUniqueOrThrow({ where: { id: tipoAjeno.id } })).activo,
    ).toBe(true);
  });

  it('solo quien tiene el permiso entra: tesorero y Coordinación 403, otra iglesia 403, sin sesión 401', async () => {
    const { iglesia } = await escenario();
    const url = `/iglesias/${iglesia.id}/tipos-espacio`;
    const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    const coordinacion = await loginComo('COORDINACION');
    const ajeno = await loginComo('ADMIN_IGLESIA', { iglesiaId: (await crearIglesia()).id });
    for (const { auth } of [tesorero, coordinacion, ajeno]) {
      expect((await panel(auth).get(url)).status).toBe(403);
      expect((await panel(auth).post(url, { clase: 'NICHO' })).status).toBe(403);
    }
    expect((await request(app).get(`/api/v1${url}`)).status).toBe(401);
  });
});

describe('tipos de espacio públicos, sin precios (RF-71, RN-48, CA-26)', () => {
  it('muestra solo los tipos activos y disponibles, sin ningún precio', async () => {
    const { iglesia } = await escenario();
    await prisma.tipoEspacio.createMany({
      data: [
        { iglesiaId: iglesia.id, clase: 'NICHO' },
        { iglesiaId: iglesia.id, clase: 'COLUMBARIO', activo: false },
        { iglesiaId: iglesia.id, clase: 'OSARIO', disponible: false },
      ],
    });
    const res = await publico.get(`/iglesias/${iglesia.id}/espacios`);
    expect(res.status).toBe(200);
    expect(res.body.data.iglesia).toEqual({ id: iglesia.id, nombre: 'Parroquia del Centro' });
    expect(res.body.data.tipos.map((t: { clase: string }) => t.clase)).toEqual(['CRIPTA', 'NICHO']);
    expect(JSON.stringify(res.body)).not.toMatch(/precio|monto|costo|cotiz/i);
  });

  it('una iglesia cerrada no ofrece tipos y una inexistente es 404', async () => {
    const { iglesia } = await escenario();
    await prisma.iglesia.update({ where: { id: iglesia.id }, data: { activa: false } });
    const cerrada = await publico.get(`/iglesias/${iglesia.id}/espacios`);
    expect(cerrada.status).toBe(200);
    expect(cerrada.body.data.tipos).toEqual([]);
    expect((await publico.get(`/iglesias/${ID_INEXISTENTE}/espacios`)).status).toBe(404);
    expect((await publico.get('/iglesias/no-es-un-id/espacios')).status).toBe(400);
  });
});

// ═════════════════════ Solicitud pública ═════════════════════

describe('crear la solicitud sin cuenta (RF-72, RF-73, RN-49, CA-26)', () => {
  const cuerpo = (tipoEspacioId: string) => ({
    tipoEspacioId,
    contacto: { nombre: 'Ana Pérez', telefono: '999 123 4567', correo: 'Ana@Ejemplo.mx' },
    comentarios: 'Para mi madre.',
  });

  it('devuelve el folio y la clave una sola vez, y guarda solo el hash de la clave', async () => {
    const { iglesia, tipo } = await escenario();
    const res = await publico.post(`/iglesias/${iglesia.id}/solicitudes-espacio`, cuerpo(tipo.id));
    expect(res.status).toBe(201);
    const { folio, clave } = res.body.data;
    expect(folio).toMatch(/^ESP-\d{4}-\d{6}$/);
    expect(clave).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    expect(res.body.data.aviso).toMatch(/no se vuelve a mostrar/);

    const guardada = await prisma.solicitudEspacio.findUniqueOrThrow({ where: { folio } });
    expect(guardada).toMatchObject({
      estado: 'RECIBIDA',
      iglesiaId: iglesia.id,
      contactoNombre: 'Ana Pérez',
      contactoCorreo: 'ana@ejemplo.mx',
    });
    expect(guardada.claveHash).toBe(hashToken(clave.replace('-', '')));
    expect(JSON.stringify(guardada)).not.toContain(clave.replace('-', ''));
  });

  it('los folios son consecutivos y distintos; las claves no se repiten', async () => {
    const { iglesia, tipo } = await escenario();
    const a = await publico.post(`/iglesias/${iglesia.id}/solicitudes-espacio`, cuerpo(tipo.id));
    const b = await publico.post(`/iglesias/${iglesia.id}/solicitudes-espacio`, cuerpo(tipo.id));
    expect(a.body.data.folio).not.toBe(b.body.data.folio);
    expect(Number(b.body.data.folio.slice(-6))).toBe(Number(a.body.data.folio.slice(-6)) + 1);
    expect(a.body.data.clave).not.toBe(b.body.data.clave);
  });

  it('valida el contacto: nombre, un teléfono o un correo, formatos y campos desconocidos (400)', async () => {
    const { iglesia, tipo } = await escenario();
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio`;
    const malos = [
      { ...cuerpo(tipo.id), contacto: { nombre: 'Ana' } },
      { ...cuerpo(tipo.id), contacto: { nombre: '  ', telefono: '9991234567' } },
      { ...cuerpo(tipo.id), contacto: { nombre: 'Ana', correo: 'no-es-correo' } },
      { ...cuerpo(tipo.id), contacto: { nombre: 'Ana', telefono: 'abc' } },
      { ...cuerpo(tipo.id), tipoEspacioId: 'x' },
      { ...cuerpo(tipo.id), estado: 'ACEPTADA' },
    ];
    for (const malo of malos) expect((await publico.post(url, malo)).status).toBe(400);
    expect(await prisma.solicitudEspacio.count()).toBe(0);
  });

  it('pide un tipo que la iglesia ofrece: de otra iglesia 404; inactivo o sin lugar 422', async () => {
    const { iglesia, tipo } = await escenario();
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio`;
    const otra = await crearIglesia();
    const tipoAjeno = await prisma.tipoEspacio.create({
      data: { iglesiaId: otra.id, clase: 'NICHO' },
    });
    expect((await publico.post(url, cuerpo(tipoAjeno.id))).status).toBe(404);

    await prisma.tipoEspacio.update({ where: { id: tipo.id }, data: { disponible: false } });
    expect((await publico.post(url, cuerpo(tipo.id))).status).toBe(422);
    await prisma.tipoEspacio.update({
      where: { id: tipo.id },
      data: { disponible: true, activo: false },
    });
    expect((await publico.post(url, cuerpo(tipo.id))).status).toBe(422);
    expect(await prisma.solicitudEspacio.count()).toBe(0);
  });

  it('una iglesia cerrada no recibe solicitudes (422) y una inexistente es 404', async () => {
    const { iglesia, tipo } = await escenario();
    await prisma.iglesia.update({ where: { id: iglesia.id }, data: { activa: false } });
    const res = await publico.post(`/iglesias/${iglesia.id}/solicitudes-espacio`, cuerpo(tipo.id));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    expect(await prisma.solicitudEspacio.count()).toBe(0);
    expect(
      (await publico.post(`/iglesias/${ID_INEXISTENTE}/solicitudes-espacio`, cuerpo(tipo.id)))
        .status,
    ).toBe(404);
  });

  it('limita las creaciones por IP (429)', async () => {
    const { iglesia, tipo } = await escenario();
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio`;
    let ultimo = 0;
    for (let i = 0; i < 11; i++) ultimo = (await publico.post(url, cuerpo(tipo.id))).status;
    expect(ultimo).toBe(429);
  });
});

describe('seguimiento con folio y clave (RF-74, RN-49, RN-53)', () => {
  it('con folio y clave ve su estado y con quién se hace; la clave se acepta escrita de otra forma', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    for (const clave of [CLAVE, 'abcde-fghjk', ' ABCDE FGHJK ']) {
      const { url, cuerpo } = acceso(s, clave);
      const res = await publico.post(`${url}/consulta`, cuerpo);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        folio: s.folio,
        estado: 'RECIBIDA',
        tipo: { clase: 'CRIPTA' },
        iglesia: {
          nombre: 'Parroquia del Centro',
          telefono: '9999000000',
          correo: 'parroquia@ejemplo.mx',
        },
        cotizacion: null,
      });
    }
    // También con el folio en minúsculas
    const minusculas = await publico.post(
      `/solicitudes-espacio/${s.folio.toLowerCase()}/consulta`,
      {
        clave: CLAVE,
      },
    );
    expect(minusculas.status).toBe(200);
  });

  it('una clave incorrecta y un folio inexistente se responden igual (404)', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const malaClave = await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, {
      clave: 'XXXXXXXXXX',
    });
    const malFolio = await publico.post('/solicitudes-espacio/ESP-2026-999999/consulta', {
      clave: CLAVE,
    });
    expect(malaClave.status).toBe(404);
    expect(malFolio.status).toBe(404);
    expect(malaClave.body.error.message).toBe(malFolio.body.error.message);
    expect((await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, {})).status).toBe(400);
  });

  it('la clave nunca vuelve a salir: ni la clave, ni su hash, ni los intentos en ninguna respuesta', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 1);
    const respuestas = [
      await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, { clave: CLAVE }),
      await panel(admin.auth).get(`/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`),
      await panel(admin.auth).get(`/iglesias/${iglesia.id}/solicitudes-espacio`),
    ];
    for (const res of respuestas) {
      expect(res.status).toBe(200);
      const texto = JSON.stringify(res.body);
      expect(texto).not.toContain(CLAVE);
      expect(texto).not.toContain(s.claveHash);
      expect(texto).not.toMatch(/claveHash|intentosFallidos|bloqueadoHasta/);
    }
  });

  it('bloquea el folio tras 5 claves incorrectas, aun con la clave correcta (429), y se libera al cumplirse', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const url = `/solicitudes-espacio/${s.folio}/consulta`;
    for (let i = 0; i < 4; i++) {
      expect((await publico.post(url, { clave: 'XXXXXXXXXX' })).status).toBe(404);
    }
    // Cuatro fallos todavía no bloquean
    expect((await publico.post(url, { clave: CLAVE })).status).toBe(200);
    for (let i = 0; i < 5; i++) await publico.post(url, { clave: 'XXXXXXXXXX' });
    const bloqueada = await publico.post(url, { clave: CLAVE });
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.error.code).toBe('RATE_LIMITED');

    const guardada = await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } });
    expect(guardada.intentosFallidos).toBe(5);
    const minutos = (guardada.bloqueadoHasta!.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);

    // Al cumplirse el bloqueo, vuelve a funcionar
    await prisma.solicitudEspacio.update({
      where: { id: s.id },
      data: { bloqueadoHasta: new Date(Date.now() - 1000) },
    });
    expect((await publico.post(url, { clave: CLAVE })).status).toBe(200);
    expect(
      (await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).intentosFallidos,
    ).toBe(0);
  });

  it('el bloqueo es por folio: otro folio no se afecta', async () => {
    const { iglesia, tipo } = await escenario();
    const a = await solicitudDirecta(iglesia.id, tipo.id);
    const b = await solicitudDirecta(iglesia.id, tipo.id);
    for (let i = 0; i < 5; i++) {
      await publico.post(`/solicitudes-espacio/${a.folio}/consulta`, { clave: 'XXXXXXXXXX' });
    }
    expect(
      (await publico.post(`/solicitudes-espacio/${a.folio}/consulta`, { clave: CLAVE })).status,
    ).toBe(429);
    expect(
      (await publico.post(`/solicitudes-espacio/${b.folio}/consulta`, { clave: CLAVE })).status,
    ).toBe(200);
  });
});

// ═════════════════════ Panel: solicitudes y cotización ═════════════════════

describe('solicitudes en el panel y cotización (RF-75–RF-77, RN-50, RN-53, CA-27, CA-28)', () => {
  it('el administrador ve las solicitudes de su iglesia con los datos de contacto', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const lista = await panel(admin.auth).get(`/iglesias/${iglesia.id}/solicitudes-espacio`);
    expect(lista.status).toBe(200);
    expect(lista.body.meta.total).toBe(1);
    expect(lista.body.data[0]).toMatchObject({
      folio: s.folio,
      estado: 'RECIBIDA',
      tipo: { clase: 'CRIPTA' },
      contacto: { nombre: 'Ana Pérez', telefono: '9991234567', correo: 'ana@ejemplo.mx' },
    });
    expect(lista.body.data[0].creadaLocal.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const detalle = await panel(admin.auth).get(
      `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`,
    );
    expect(detalle.body.data.contacto.nombre).toBe('Ana Pérez');
  });

  it('RN-54: el personal de otra iglesia no ve ni cotiza (403 con su ruta ajena, 404 con la propia)', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const otra = await crearIglesia();
    const ajeno = await loginComo('ADMIN_IGLESIA', { iglesiaId: otra.id });

    const rutaAjena = `/iglesias/${iglesia.id}/solicitudes-espacio`;
    expect((await panel(ajeno.auth).get(rutaAjena)).status).toBe(403);
    expect((await panel(ajeno.auth).get(`${rutaAjena}/${s.id}`)).status).toBe(403);
    expect(
      (
        await panel(ajeno.auth).post(`${rutaAjena}/${s.id}/cotizacion`, {
          monto: '100',
          condiciones: 'x',
        })
      ).status,
    ).toBe(403);

    const rutaPropia = `/iglesias/${otra.id}/solicitudes-espacio`;
    expect((await panel(ajeno.auth).get(`${rutaPropia}/${s.id}`)).status).toBe(404);
    expect(
      (
        await panel(ajeno.auth).post(`${rutaPropia}/${s.id}/cotizacion`, {
          monto: '100',
          condiciones: 'x',
        })
      ).status,
    ).toBe(404);
    expect((await panel(ajeno.auth).post(`${rutaPropia}/${s.id}/sin-lugar`)).status).toBe(404);
    expect((await panel(ajeno.auth).get(rutaPropia)).body.data).toEqual([]);

    expect((await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).estado).toBe(
      'RECIBIDA',
    );
    expect(await prisma.cotizacion.count()).toBe(0);
    expect((await panel(admin.auth).get(`${rutaAjena}/${s.id}`)).status).toBe(200);
  });

  it('la Coordinación, el tesorero y quien no inició sesión no entran a las solicitudes', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`;
    const coordinacion = await loginComo('COORDINACION');
    const tesorero = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    for (const { auth } of [coordinacion, tesorero]) {
      expect((await panel(auth).get(url)).status).toBe(403);
      expect(
        (await panel(auth).post(`${url}/cotizacion`, { monto: '100', condiciones: 'x' })).status,
      ).toBe(403);
    }
    expect((await request(app).get(`/api/v1${url}`)).status).toBe(401);
    expect((await request(app).post(`/api/v1${url}/sin-lugar`)).status).toBe(401);
  });

  it('CA-28: cotiza con monto y condiciones; vale 15 días y la persona lo ve con quién se hace', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const res = await panel(admin.auth).post(
      `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}/cotizacion`,
      {
        monto: '12500.5',
        condiciones: 'Anticipo del 50 %.',
      },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('COTIZADA');
    const c = res.body.data.cotizacion;
    expect(c).toMatchObject({
      monto: '12500.50',
      condiciones: 'Anticipo del 50 %.',
      vigente: true,
      respuesta: null,
    });
    expect(new Date(c.venceEn).getTime() - new Date(c.emitidaEn).getTime()).toBe(15 * DIA);
    expect(c.venceLocal.hora).toMatch(/^\d{2}:\d{2}$/);

    const visto = await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, { clave: CLAVE });
    expect(visto.body.data).toMatchObject({
      estado: 'COTIZADA',
      iglesia: { nombre: 'Parroquia del Centro', telefono: '9999000000' },
      cotizacion: { monto: '12500.50', condiciones: 'Anticipo del 50 %.' },
    });
  });

  it('valida el monto (cero, negativo, decimales de más, texto, número) y las condiciones (400)', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}/cotizacion`;
    for (const monto of ['0', '0.00', '-5', '12.345', 'abc', 1500, '']) {
      const res = await panel(admin.auth).post(url, { monto, condiciones: 'x' });
      expect(res.status, String(monto)).toBe(400);
    }
    expect((await panel(admin.auth).post(url, { monto: '100', condiciones: '  ' })).status).toBe(
      400,
    );
    expect(
      (await panel(admin.auth).post(url, { monto: '100', condiciones: 'x', estado: 'ACEPTADA' }))
        .status,
    ).toBe(400);
    expect(await prisma.cotizacion.count()).toBe(0);
  });

  it('solo se cotiza una solicitud recibida (422); no hay segunda cotización (supuesto P-26)', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`;
    expect(
      (await panel(admin.auth).post(`${url}/cotizacion`, { monto: '100', condiciones: 'x' }))
        .status,
    ).toBe(201);
    expect(
      (await panel(admin.auth).post(`${url}/cotizacion`, { monto: '200', condiciones: 'y' }))
        .status,
    ).toBe(422);
    expect((await panel(admin.auth).post(`${url}/sin-lugar`)).status).toBe(422);
    expect(await prisma.cotizacion.count()).toBe(1);
  });

  it('CA-27: avisa que no hay lugar; la persona lo ve y ya no puede aceptar ni se cotiza', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`;
    const res = await panel(admin.auth).post(`${url}/sin-lugar`);
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('SIN_LUGAR');

    const visto = await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, { clave: CLAVE });
    expect(visto.body.data.estado).toBe('SIN_LUGAR');
    expect(
      (await publico.post(`/solicitudes-espacio/${s.folio}/aceptar`, { clave: CLAVE })).status,
    ).toBe(422);
    expect(
      (await panel(admin.auth).post(`${url}/cotizacion`, { monto: '100', condiciones: 'x' }))
        .status,
    ).toBe(422);
    expect((await panel(admin.auth).post(`${url}/sin-lugar`)).status).toBe(422);
  });

  it('filtra por estado efectivo y pagina', async () => {
    const { iglesia, admin, tipo } = await escenario();
    await solicitudDirecta(iglesia.id, tipo.id);
    await solicitudDirecta(iglesia.id, tipo.id, { estado: 'SIN_LUGAR' });
    await solicitudCotizada(iglesia.id, tipo.id, 2);
    await solicitudCotizada(iglesia.id, tipo.id, 20);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio`;
    const cuenta = async (q: string) => (await panel(admin.auth).get(`${url}${q}`)).body.meta.total;
    expect(await cuenta('')).toBe(4);
    expect(await cuenta('?estado=RECIBIDA')).toBe(1);
    expect(await cuenta('?estado=SIN_LUGAR')).toBe(1);
    // La cotizada de hace 20 días ya cuenta como vencida, aunque nadie haya guardado el cambio
    expect(await cuenta('?estado=COTIZADA')).toBe(1);
    expect(await cuenta('?estado=VENCIDA')).toBe(1);
    expect((await panel(admin.auth).get(`${url}?limit=2&page=2`)).body.data).toHaveLength(2);
    expect((await panel(admin.auth).get(`${url}?estado=INVENTADO`)).status).toBe(400);
  });
});

// ═════════════════════ Respuesta de la persona ═════════════════════

describe('aceptar, rechazar y cancelar (RF-78, RF-80, RN-52, CA-28, CA-29)', () => {
  const accion = (s: { folio: string }, que: 'aceptar' | 'rechazar' | 'cancelar') =>
    publico.post(`/solicitudes-espacio/${s.folio}/${que}`, { clave: CLAVE });

  it('CA-28: aceptar deja la solicitud Aceptada y ya no se cancela', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 3);
    const res = await accion(s, 'aceptar');
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('ACEPTADA');
    expect(res.body.data.cotizacion).toMatchObject({ respuesta: 'ACEPTADA', vigente: false });

    expect((await accion(s, 'cancelar')).status).toBe(422);
    expect((await accion(s, 'rechazar')).status).toBe(422);
    expect((await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).estado).toBe(
      'ACEPTADA',
    );
  });

  it('rechazar deja la solicitud Rechazada con su cotización', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 3);
    const res = await accion(s, 'rechazar');
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('RECHAZADA');
    expect(res.body.data.cotizacion.respuesta).toBe('RECHAZADA');
    expect((await accion(s, 'aceptar')).status).toBe(422);
  });

  it('no se acepta ni se rechaza lo que no tiene cotización (422)', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    expect((await accion(s, 'aceptar')).status).toBe(422);
    expect((await accion(s, 'rechazar')).status).toBe(422);
  });

  it('CA-29: cancela mientras no acepte, con la cotización vigente o sin cotizar, y conserva su historial', async () => {
    const { iglesia, tipo } = await escenario();
    const cotizada = await solicitudCotizada(iglesia.id, tipo.id, 5);
    const res = await accion(cotizada, 'cancelar');
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('CANCELADA');
    // La cotización sigue ahí con sus datos
    expect(await prisma.cotizacion.count({ where: { solicitudId: cotizada.id } })).toBe(1);

    const recibida = await solicitudDirecta(iglesia.id, tipo.id);
    expect((await accion(recibida, 'cancelar')).body.data.estado).toBe('CANCELADA');
    expect((await accion(recibida, 'cancelar')).status).toBe(422);
  });

  it('las acciones piden folio y clave correctos: con otra clave no cambian nada', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 3);
    const res = await publico.post(`/solicitudes-espacio/${s.folio}/aceptar`, {
      clave: 'XXXXXXXXXX',
    });
    expect(res.status).toBe(404);
    expect((await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).estado).toBe(
      'COTIZADA',
    );
    expect((await publico.post(`/solicitudes-espacio/${s.folio}/aceptar`, {})).status).toBe(400);
  });

  it('dos aceptaciones a la vez: solo una se aplica', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 3);
    const estados = (
      await Promise.all([accion(s, 'aceptar'), accion(s, 'aceptar'), accion(s, 'cancelar')])
    ).map((r) => r.status);
    expect(estados.filter((e) => e === 200)).toHaveLength(1);
    const final = (await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).estado;
    expect(['ACEPTADA', 'CANCELADA']).toContain(final);
  });
});

describe('vencimiento de la cotización (RN-51, CA-29, supuesto P-26)', () => {
  const accion = (s: { folio: string }, que: 'aceptar' | 'rechazar' | 'cancelar') =>
    publico.post(`/solicitudes-espacio/${s.folio}/${que}`, { clave: CLAVE });
  const guardada = (id: string) =>
    prisma.solicitudEspacio.findUniqueOrThrow({
      where: { id },
      include: { cotizaciones: true },
    });

  it('CA-29: a los 16 días aparece Vencida al consultar, sin guardar nada todavía', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 16);
    const visto = await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, { clave: CLAVE });
    expect(visto.body.data.estado).toBe('VENCIDA');
    expect(visto.body.data.cotizacion.vigente).toBe(false);
    const enPanel = await panel(admin.auth).get(
      `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`,
    );
    expect(enPanel.body.data.estado).toBe('VENCIDA');
    // Consultar no escribe: lo guardado sigue como estaba
    expect((await guardada(s.id)).estado).toBe('COTIZADA');
  });

  it('CA-29: aceptar una cotización vencida responde 422 y el vencimiento QUEDA guardado después del error', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 16);
    const res = await accion(s, 'aceptar');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/venció/);
    // Se lee la BD después del 422: el cambio no se deshizo con el error
    const despues = await guardada(s.id);
    expect(despues.estado).toBe('VENCIDA');
    expect(despues.cotizaciones[0]).toMatchObject({ respuesta: 'VENCIDA' });
    expect(despues.cotizaciones[0]!.respondidaEn).toEqual(despues.cotizaciones[0]!.venceEn);
  });

  it('rechazar y cancelar una cotización vencida también guardan el vencimiento y responden 422', async () => {
    const { iglesia, tipo } = await escenario();
    for (const que of ['rechazar', 'cancelar'] as const) {
      const s = await solicitudCotizada(iglesia.id, tipo.id, 20);
      expect((await accion(s, que)).status).toBe(422);
      expect((await guardada(s.id)).estado).toBe('VENCIDA');
    }
  });

  it('el administrador tampoco cotiza ni marca sin lugar sobre una vencida: guarda el vencimiento y 422', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 16);
    const url = `/iglesias/${iglesia.id}/solicitudes-espacio/${s.id}`;
    expect(
      (await panel(admin.auth).post(`${url}/cotizacion`, { monto: '100', condiciones: 'x' }))
        .status,
    ).toBe(422);
    expect((await guardada(s.id)).estado).toBe('VENCIDA');
    expect((await panel(admin.auth).post(`${url}/sin-lugar`)).status).toBe(422);
    expect(await prisma.cotizacion.count({ where: { solicitudId: s.id } })).toBe(1);
  });

  it('con 14 días todavía se acepta; la segunda solicitud del caso (5 días) se cancela y queda Cancelada', async () => {
    const { iglesia, tipo } = await escenario();
    const vigente = await solicitudCotizada(iglesia.id, tipo.id, 14);
    expect((await accion(vigente, 'aceptar')).body.data.estado).toBe('ACEPTADA');
    const reciente = await solicitudCotizada(iglesia.id, tipo.id, 5);
    expect((await accion(reciente, 'cancelar')).body.data.estado).toBe('CANCELADA');
  });
});

// ═════════════════════ Iglesia cerrada ═════════════════════

describe('una iglesia cerrada no acepta escrituras (RN-07, A2-E1-01)', () => {
  const cerrar = (id: string) => prisma.iglesia.update({ where: { id }, data: { activa: false } });
  const accion = (s: { folio: string }, que: 'aceptar' | 'rechazar' | 'cancelar') =>
    publico.post(`/solicitudes-espacio/${s.folio}/${que}`, { clave: CLAVE });

  it('en las rutas públicas: no crea, no acepta, no rechaza y no cancela (422), pero sí consulta', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudCotizada(iglesia.id, tipo.id, 3);
    await cerrar(iglesia.id);
    for (const que of ['aceptar', 'rechazar', 'cancelar'] as const) {
      const res = await accion(s, que);
      expect(res.status, que).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE');
    }
    expect((await prisma.solicitudEspacio.findUniqueOrThrow({ where: { id: s.id } })).estado).toBe(
      'COTIZADA',
    );
    // Leer su historia sí se puede
    expect(
      (await publico.post(`/solicitudes-espacio/${s.folio}/consulta`, { clave: CLAVE })).status,
    ).toBe(200);
  });

  it('en el panel: no cotiza, no marca sin lugar ni agrega o edita tipos (422), pero sí lista', async () => {
    const { iglesia, admin, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    await cerrar(iglesia.id);
    const base = `/iglesias/${iglesia.id}`;
    const intentos = [
      panel(admin.auth).post(`${base}/solicitudes-espacio/${s.id}/cotizacion`, {
        monto: '100',
        condiciones: 'x',
      }),
      panel(admin.auth).post(`${base}/solicitudes-espacio/${s.id}/sin-lugar`),
      panel(admin.auth).post(`${base}/tipos-espacio`, { clase: 'NICHO' }),
      panel(admin.auth).patch(`${base}/tipos-espacio/${tipo.id}`, { activo: false }),
    ];
    for (const res of await Promise.all(intentos)) expect(res.status).toBe(422);
    expect((await panel(admin.auth).get(`${base}/solicitudes-espacio`)).status).toBe(200);
    expect((await panel(admin.auth).get(`${base}/tipos-espacio`)).status).toBe(200);
    expect(await prisma.cotizacion.count()).toBe(0);
  });
});

// ═════════════════════ Restricciones de la base de datos ═════════════════════

describe('restricciones de la BD (E4-07, RN-44, RN-51, RNF-10)', () => {
  it('no admite una cotización de monto cero o con vencimiento anterior a la emisión', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const emitidaEn = new Date();
    const base = {
      solicitudId: s.id,
      condiciones: 'x',
      emitidaEn,
      venceEn: fechaVencimiento(emitidaEn),
    };
    await expect(prisma.cotizacion.create({ data: { ...base, monto: '0' } })).rejects.toThrow();
    await expect(prisma.cotizacion.create({ data: { ...base, monto: '-1' } })).rejects.toThrow();
    await expect(
      prisma.cotizacion.create({
        data: { ...base, monto: '10', venceEn: new Date(emitidaEn.getTime() - 1) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.cotizacion.create({ data: { ...base, monto: '10.00' } }),
    ).resolves.toBeTruthy();
  });

  it('permite varias cotizaciones por solicitud, pero a lo sumo una sin respuesta (P-26 abierta)', async () => {
    const { iglesia, tipo } = await escenario();
    const s = await solicitudDirecta(iglesia.id, tipo.id);
    const emitidaEn = new Date();
    const datos = {
      solicitudId: s.id,
      monto: '10',
      condiciones: 'x',
      emitidaEn,
      venceEn: fechaVencimiento(emitidaEn),
    };
    const primera = await prisma.cotizacion.create({ data: datos });
    await expect(prisma.cotizacion.create({ data: datos })).rejects.toThrow();
    // Cerrada la primera, cabe otra: no hace falta otra migración si el cliente permite volver a cotizar
    await prisma.cotizacion.update({ where: { id: primera.id }, data: { respuesta: 'RECHAZADA' } });
    await expect(prisma.cotizacion.create({ data: datos })).resolves.toBeTruthy();
    expect(await prisma.cotizacion.count({ where: { solicitudId: s.id } })).toBe(2);
  });

  it('una solicitud no puede ser de otra iglesia que su tipo de espacio', async () => {
    const { tipo } = await escenario();
    const otra = await crearIglesia();
    await expect(solicitudDirecta(otra.id, tipo.id)).rejects.toThrow(/misma iglesia/);
  });

  it('no se borra una iglesia ni un tipo con solicitudes (RESTRICT)', async () => {
    const { iglesia, tipo } = await escenario();
    await solicitudDirecta(iglesia.id, tipo.id);
    await expect(prisma.tipoEspacio.delete({ where: { id: tipo.id } })).rejects.toThrow();
    await expect(prisma.iglesia.delete({ where: { id: iglesia.id } })).rejects.toThrow();
  });
});
