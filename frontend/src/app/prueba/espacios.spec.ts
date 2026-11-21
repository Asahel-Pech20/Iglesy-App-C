import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperar, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const IGLESIA = 'ig-comunidad';
const CLAVE = 'ABCDE-FGHJK';

const botones = () => [...document.querySelectorAll<HTMLElement>('button, a')];
const conTexto = (texto: string | RegExp) =>
  botones().find((b) =>
    typeof texto === 'string' ? b.textContent?.trim() === texto : texto.test(b.textContent ?? ''),
  );
const enDialogo = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')].find(
    (b) => b.textContent?.trim() === texto,
  );
const opciones = () => [...document.querySelectorAll<HTMLElement>('mat-option')];
const campo = (etiqueta: string) =>
  [...document.querySelectorAll('mat-form-field')].find((c) => c.textContent?.includes(etiqueta));
const inputDe = (etiqueta: string) =>
  campo(etiqueta)?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? null;
const filas = (etiqueta: string) => [
  ...document.querySelectorAll(`table[aria-label="${etiqueta}"] tbody tr`),
];

/** Abre el mat-select con esa etiqueta y elige la opción. */
async function elegir(etiqueta: string, opcion: string) {
  campo(etiqueta)!.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
  await esperarA(() => opciones().some((o) => o.textContent?.includes(opcion)));
  opciones()
    .find((o) => o.textContent?.includes(opcion))!
    .click();
  await esperarA(() => opciones().length === 0);
}

// ═════════════════════ Pública: solicitar ═════════════════════

describe('solicitar un espacio sin cuenta (RF-71–RF-73, CA-26)', () => {
  it('muestra solo los tipos activos y disponibles, sin ningún precio', async () => {
    await abrirApp(`/espacios/${IGLESIA}`);
    await esperarA(() => textoPagina().includes('Tipo de espacio'));
    campo('Tipo de espacio')!.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    await esperarA(() => opciones().length > 0);
    expect(opciones().map((o) => o.textContent?.trim())).toEqual(['Cripta', 'Nicho']);
    expect(textoPagina()).toContain('Parroquia Comunidad de Fe');
    expect(textoPagina()).toContain('Los precios no se publican');
    expect(textoPagina()).not.toMatch(/\$\s?\d/);
  });

  it('envía la solicitud y muestra el folio y la clave una sola vez', async () => {
    await abrirApp(`/espacios/${IGLESIA}`);
    await esperarA(() => textoPagina().includes('Tipo de espacio'));
    const antes = db.solicitudesEspacio.length;
    await elegir('Tipo de espacio', 'Nicho');
    escribir(inputDe('Tu nombre'), 'Carmen Uc Pech');
    escribir(inputDe('Teléfono'), '999 123 4567');
    conTexto('Enviar solicitud')!.click();
    await esperarA(() => document.querySelector('[data-prueba="folio"]') !== null);

    const folio = document.querySelector('[data-prueba="folio"]')!.textContent!.trim();
    const clave = document.querySelector('[data-prueba="clave"]')!.textContent!.trim();
    expect(folio).toMatch(/^ESP-\d{4}-\d{6}$/);
    expect(clave).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    expect(textoPagina()).toContain('la clave no se vuelve a mostrar');
    expect(db.solicitudesEspacio).toHaveLength(antes + 1);
    expect(db.solicitudesEspacio.at(-1)).toMatchObject({
      folio,
      iglesiaId: IGLESIA,
      estado: 'RECIBIDA',
      contactoNombre: 'Carmen Uc Pech',
    });
    // El enlace de seguimiento lleva el folio, nunca la clave
    const enlace = document.querySelector<HTMLAnchorElement>('a[href*="seguimiento"]')!;
    expect(enlace.getAttribute('href')).toContain(`folio=${folio}`);
    expect(enlace.getAttribute('href')).not.toContain(clave);
  });

  it('valida el formulario sin llamar al servidor: tipo, nombre y un medio de contacto', async () => {
    await abrirApp(`/espacios/${IGLESIA}`);
    await esperarA(() => textoPagina().includes('Tipo de espacio'));
    const antes = db.solicitudesEspacio.length;
    conTexto('Enviar solicitud')!.click();
    await esperarA(() => textoPagina().includes('Escribe tu nombre.'));
    expect(textoPagina()).toContain('Elige el tipo de espacio.');
    expect(textoPagina()).toContain('Deja un teléfono o un correo');
    expect(db.solicitudesEspacio).toHaveLength(antes);

    escribir(inputDe('Correo'), 'no-es-correo');
    escribir(inputDe('Teléfono'), 'abc');
    conTexto('Enviar solicitud')!.click();
    await esperarA(() => textoPagina().includes('Correo no válido.'));
    expect(textoPagina()).toContain('Teléfono no válido.');
  });

  it('una iglesia cerrada no ofrece espacios: estado vacío y sin formulario', async () => {
    // abrirApp reinicia los datos: la iglesia se cierra después y entonces se entra a la página
    const { harness } = await abrirApp('/');
    db.iglesias.find((i) => i.id === IGLESIA)!.activa = false;
    await harness.navigateByUrl(`/espacios/${IGLESIA}`);
    await esperarA(() => textoPagina().includes('no ofrece espacios por ahora'));
    expect(conTexto('Enviar solicitud')).toBeUndefined();
  });

  it('si el tipo dejó de estar disponible mientras llenaba el formulario, el servidor responde 422 y se muestra', async () => {
    await abrirApp(`/espacios/${IGLESIA}`);
    await esperarA(() => textoPagina().includes('Tipo de espacio'));
    await elegir('Tipo de espacio', 'Nicho');
    escribir(inputDe('Tu nombre'), 'Carmen Uc Pech');
    escribir(inputDe('Correo'), 'carmen@ejemplo.mx');
    db.tiposEspacio.find((t) => t.id === 'te-nicho')!.disponible = false;
    const antes = db.solicitudesEspacio.length;
    conTexto('Enviar solicitud')!.click();
    await esperarA(() => textoPagina().includes('no está disponible por ahora'));
    expect(db.solicitudesEspacio).toHaveLength(antes);
  });
});

// ═════════════════════ Pública: seguimiento ═════════════════════

describe('seguimiento con folio y clave (RF-74, RF-78, RF-80, CA-28, CA-29)', () => {
  async function consultar(folio: string, clave = CLAVE) {
    await abrirApp(`/espacios/seguimiento?folio=${folio}`);
    await esperarA(() => (inputDe('Folio') as HTMLInputElement | null)?.value === folio);
    escribir(inputDe('Clave'), clave);
    conTexto('Consultar')!.click();
  }

  it('el folio del enlace se escribe solo y la consulta muestra el estado, la cotización y con quién se hace', async () => {
    await consultar('ESP-2026-000002');
    await esperarA(() => textoPagina().includes('Cotizada'));
    expect(document.querySelector('[data-prueba="monto"]')!.textContent).toContain('$12,500.50');
    expect(textoPagina()).toContain('Con quién se hace');
    expect(textoPagina()).toContain('Parroquia Comunidad de Fe');
    expect(textoPagina()).toContain('9999000000');
    expect(textoPagina()).toContain('Anticipo del 50 %');
    expect(textoPagina()).not.toContain('Luis Canul');
  });

  it('una clave incorrecta muestra el mensaje general; tras 5 intentos bloquea el folio', async () => {
    await abrirApp('/espacios/seguimiento');
    await esperarA(() => inputDe('Folio') !== null);
    escribir(inputDe('Folio'), 'ESP-2026-000002');
    for (let i = 0; i < 5; i++) {
      escribir(inputDe('Clave'), 'XXXXX-XXXXX');
      conTexto('Consultar')!.click();
      await esperarA(() => textoPagina().includes('El folio o la clave no son correctos.'));
      await esperar(5);
    }
    escribir(inputDe('Clave'), CLAVE);
    conTexto('Consultar')!.click();
    await esperarA(() => textoPagina().includes('Demasiados intentos con este folio'));
  });

  it('valida que se escriban el folio y la clave', async () => {
    await abrirApp('/espacios/seguimiento');
    await esperarA(() => inputDe('Folio') !== null);
    conTexto('Consultar')!.click();
    await esperarA(() => textoPagina().includes('Escribe tu folio.'));
    expect(textoPagina()).toContain('Escribe tu clave.');
  });

  it('CA-28: aceptar con confirmación deja la solicitud Aceptada y ya no se puede cancelar', async () => {
    await consultar('ESP-2026-000002');
    await esperarA(() => conTexto('Aceptar cotización') !== undefined);
    conTexto('Aceptar cotización')!.click();
    await esperarA(() => enDialogo('Aceptar') !== undefined);
    expect(textoPagina()).toContain('$12,500.50');
    enDialogo('Aceptar')!.click();
    await esperarA(() => db.solicitudesEspacio.find((s) => s.id === 'so-2')!.estado === 'ACEPTADA');
    await esperarA(() => textoPagina().includes('Aceptaste la cotización'));
    expect(conTexto('Cancelar solicitud')).toBeUndefined();
    expect(conTexto('Aceptar cotización')).toBeUndefined();
  });

  it('rechazar deja la solicitud Rechazada', async () => {
    await consultar('ESP-2026-000002');
    await esperarA(() => conTexto('Rechazar cotización') !== undefined);
    conTexto('Rechazar cotización')!.click();
    await esperarA(() => enDialogo('Rechazar') !== undefined);
    enDialogo('Rechazar')!.click();
    await esperarA(
      () => db.solicitudesEspacio.find((s) => s.id === 'so-2')!.estado === 'RECHAZADA',
    );
  });

  it('cancelar una solicitud recibida pide confirmación y la deja Cancelada', async () => {
    await consultar('ESP-2026-000001');
    await esperarA(() => conTexto('Cancelar solicitud') !== undefined);
    expect(conTexto('Aceptar cotización')).toBeUndefined();
    conTexto('Cancelar solicitud')!.click();
    await esperarA(() => enDialogo('Cancelar solicitud') !== undefined);
    enDialogo('Cancelar solicitud')!.click();
    await esperarA(
      () => db.solicitudesEspacio.find((s) => s.id === 'so-1')!.estado === 'CANCELADA',
    );
    await esperarA(() => textoPagina().includes('Cancelaste esta solicitud'));
  });

  it('CA-29: una cotización de 20 días aparece Vencida y no se ofrece aceptarla', async () => {
    await consultar('ESP-2026-000003');
    await esperarA(() => textoPagina().includes('Vencida'));
    expect(textoPagina()).toContain('La cotización venció sin respuesta');
    expect(conTexto('Aceptar cotización')).toBeUndefined();
    expect(conTexto('Cancelar solicitud')).toBeUndefined();
    // Consultar no guarda nada
    expect(db.solicitudesEspacio.find((s) => s.id === 'so-3')!.estado).toBe('COTIZADA');
  });

  it('si la cotización venció mientras la persona decidía, se rechaza (422), el vencimiento queda guardado y la pantalla lo refleja', async () => {
    await consultar('ESP-2026-000002');
    await esperarA(() => conTexto('Aceptar cotización') !== undefined);
    // Pasan los días mientras la persona lo piensa
    const c = db.cotizacionesEspacio.find((x) => x.solicitudId === 'so-2')!;
    c.venceEn = new Date(Date.now() - 1000).toISOString();
    conTexto('Aceptar cotización')!.click();
    await esperarA(() => enDialogo('Aceptar') !== undefined);
    enDialogo('Aceptar')!.click();
    await esperarA(() => textoPagina().includes('La cotización venció'));
    expect(db.solicitudesEspacio.find((s) => s.id === 'so-2')!.estado).toBe('VENCIDA');
    expect(c.respuesta).toBe('VENCIDA');
    enDialogo('Cancelar')!.click();
    await esperarA(() => conTexto('Aceptar cotización') === undefined);
    expect(textoPagina()).toContain('Vencida');
  });

  it('si la iglesia cerró, la respuesta se rechaza y se explica; consultar sigue funcionando', async () => {
    await consultar('ESP-2026-000002');
    await esperarA(() => conTexto('Cancelar solicitud') !== undefined);
    db.iglesias.find((i) => i.id === IGLESIA)!.activa = false;
    conTexto('Cancelar solicitud')!.click();
    await esperarA(() => enDialogo('Cancelar solicitud') !== undefined);
    enDialogo('Cancelar solicitud')!.click();
    await esperarA(() => textoPagina().includes('ya no recibe respuestas'));
    expect(db.solicitudesEspacio.find((s) => s.id === 'so-2')!.estado).toBe('COTIZADA');
  });
});

// ═════════════════════ Panel ═════════════════════

describe('panel de espacios (RF-70, RF-75–RF-77, CA-27, CA-28)', () => {
  it('el administrador ve las solicitudes de su iglesia con el estado y no las de otra', async () => {
    await abrirApp('/espacios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Solicitudes de espacio').length > 0);
    expect(filas('Solicitudes de espacio')).toHaveLength(6);
    expect(textoPagina()).toContain('ESP-2026-000001');
    expect(textoPagina()).not.toContain('ESP-2026-000007');
    expect(textoPagina()).not.toContain('Persona de otra iglesia');
    // La cotizada de hace 20 días ya se ve Vencida
    const fila3 = filas('Solicitudes de espacio').find((f) => f.textContent?.includes('000003'))!;
    expect(fila3.textContent).toContain('Vencida');
  });

  it('el personal de otra iglesia solo ve lo suyo', async () => {
    await abrirApp('/espacios', { como: 'admin2@iglesia.local' });
    await esperarA(() => filas('Solicitudes de espacio').length > 0);
    expect(filas('Solicitudes de espacio')).toHaveLength(1);
    expect(textoPagina()).toContain('ESP-2026-000007');
  });

  it('filtra por estado', async () => {
    await abrirApp('/espacios?estado=VENCIDA', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Solicitudes de espacio').length > 0);
    expect(filas('Solicitudes de espacio')).toHaveLength(1);
    expect(textoPagina()).toContain('ESP-2026-000003');
  });

  it('CA-28: abre una solicitud recibida, valida el monto y la cotiza; ve el contacto', async () => {
    await abrirApp('/espacios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Solicitudes de espacio').length > 0);
    const fila = filas('Solicitudes de espacio').find((f) => f.textContent?.includes('000001'))!;
    [...fila.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Abrir')!.click();
    await esperarA(() => textoPagina().includes('Enviar cotización'));
    expect(textoPagina()).toContain('Ana Pérez Uc');
    expect(textoPagina()).toContain('9991234567');

    const antes = db.cotizacionesEspacio.length;
    for (const malo of ['', '0', '12.345', 'abc']) {
      escribir(inputDe('Monto'), malo);
      escribir(inputDe('Condiciones'), 'Pago de contado.');
      enDialogo('Enviar cotización')!.click();
      await esperar(10);
      expect(textoPagina()).toMatch(/Escribe el monto|Monto no válido|mayor que cero/);
    }
    expect(db.cotizacionesEspacio).toHaveLength(antes);

    escribir(inputDe('Monto'), '15000.5');
    escribir(inputDe('Condiciones'), 'Pago de contado.');
    enDialogo('Enviar cotización')!.click();
    await esperarA(() => db.cotizacionesEspacio.length === antes + 1);
    expect(db.solicitudesEspacio.find((s) => s.id === 'so-1')!.estado).toBe('COTIZADA');
    expect(db.cotizacionesEspacio.at(-1)!.monto).toBe('15000.50');
    await esperarA(
      () =>
        document.querySelector('[data-prueba="monto"]')?.textContent?.includes('$15,000.50') ===
        true,
    );
    expect(enDialogo('Enviar cotización')).toBeUndefined();
  });

  it('CA-27: avisa que no hay lugar con confirmación', async () => {
    await abrirApp('/espacios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Solicitudes de espacio').length > 0);
    const fila = filas('Solicitudes de espacio').find((f) => f.textContent?.includes('000001'))!;
    [...fila.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Abrir')!.click();
    await esperarA(() => enDialogo('No hay lugar') !== undefined);
    enDialogo('No hay lugar')!.click();
    // La confirmación es un segundo diálogo, encima del detalle
    const confirmacion = () => document.querySelectorAll('mat-dialog-container')[1];
    await esperarA(() => confirmacion()?.querySelector('.boton-peligro') != null);
    confirmacion()!.querySelector<HTMLButtonElement>('.boton-peligro')!.click();
    await esperarA(
      () => db.solicitudesEspacio.find((s) => s.id === 'so-1')!.estado === 'SIN_LUGAR',
    );
    expect(db.cotizacionesEspacio.some((c) => c.solicitudId === 'so-1')).toBe(false);
  });

  it('en la pestaña Tipos se marca un tipo con lugar o sin lugar y se desactiva sin borrarlo', async () => {
    await abrirApp('/espacios?tab=tipos', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Tipos de espacio').length > 0);
    expect(filas('Tipos de espacio')).toHaveLength(4);
    // Solo se ofrecen las clases que la iglesia todavía no tiene: aquí ya están las cuatro
    expect(campo('Agregar tipo')).toBeUndefined();

    // La tabla se vuelve a dibujar al guardar: cada vez se busca de nuevo el interruptor
    const interruptor = (n: number) =>
      filas('Tipos de espacio')
        .find((f) => f.textContent?.includes('Columbario'))
        ?.querySelectorAll<HTMLButtonElement>('button[role="switch"]')[n];
    expect(interruptor(1)!.getAttribute('aria-checked')).toBe('false');
    interruptor(1)!.click();
    await esperarA(() => db.tiposEspacio.find((t) => t.id === 'te-columbario')!.disponible);
    await esperarA(() => interruptor(1)?.getAttribute('aria-checked') === 'true');

    interruptor(0)!.click();
    await esperarA(() => !db.tiposEspacio.find((t) => t.id === 'te-columbario')!.activo);
    expect(db.tiposEspacio.some((t) => t.id === 'te-columbario')).toBe(true);
  });

  it('permisos: el tesorero y la Coordinación no ven el panel; el administrador sí tiene el menú', async () => {
    const tesorero = await abrirApp('/espacios', { como: 'tesorero@iglesia.local' });
    await esperarA(() => tesorero.router.url.startsWith('/sin-acceso'));
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    const coordinacion = await abrirApp('/espacios', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => coordinacion.router.url.startsWith('/sin-acceso'));
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    await abrirApp('/', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Diezmo'));
    expect(textoPagina()).toContain('Espacios');
  });

  it('el servidor también rechaza al tesorero y a otra iglesia aunque se llame a la API directo (403)', async () => {
    const { sesion } = await abrirApp('/', { como: 'tesorero@iglesia.local' });
    expect(sesion.puede('espacios:leer')).toBe(false);
    const { EspaciosService } = await import('@/app/features/espacios/espacios.service');
    const servicio = TestBed.inject(EspaciosService);
    const resultado = await new Promise<number>((resolver) =>
      servicio.listarSolicitudes({}).subscribe({
        next: () => resolver(200),
        error: (e: { status?: number }) => resolver(e.status ?? 0),
      }),
    );
    expect(resultado).toBe(403);
  });
});
