import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperar, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

// Rango amplio para no depender del día en que se ejecutan las pruebas
const TODO = '/diezmo?desde=2000-01-01&hasta=2999-12-31';

const botones = () => [...document.querySelectorAll<HTMLElement>('button, a')];
const conTexto = (texto: string | RegExp) =>
  botones().find((b) =>
    typeof texto === 'string' ? b.textContent?.trim() === texto : texto.test(b.textContent ?? ''),
  );
const enDialogo = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')].find(
    (b) => b.textContent?.trim() === texto,
  );
const filas = () => [
  ...document.querySelectorAll('table[aria-label^="Misas celebradas"] tbody tr'),
];
const filaDe = (hora: string, padre: string) =>
  filas().find((f) => f.textContent?.includes(hora) && f.textContent.includes(padre));

describe('diezmo: lista de misas', () => {
  it('el tesorero ve las misas de su iglesia con hora local, padre y monto', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    // 5 misas de su iglesia; la de otra iglesia no aparece
    expect(filas()).toHaveLength(5);
    expect(textoPagina()).not.toContain('99,999');
    expect(textoPagina()).toContain('$1,250.50');
    // La misa de las 00:00 UTC se muestra a las 18:00, hora de la Ciudad de México (RN-31)
    expect(filaDe('18:00', 'Ramón Cauich Dzul')).toBeTruthy();
    expect(filaDe('10:00', 'Luis Pérez Cámara')).toBeTruthy();
    // La misa sin captura lo dice
    expect(filaDe('18:00', 'Ramón Cauich Dzul')!.textContent).toContain('Sin captura');
  });

  it('muestra el estado vacío cuando el periodo no tiene misas', async () => {
    await abrirApp('/diezmo?desde=2000-01-01&hasta=2000-01-31', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('No hay misas en este periodo'));
    expect(filas()).toHaveLength(0);
  });
});

describe('diezmo: captura, corrección e historial', () => {
  it('captura el diezmo de una misa sin captura', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    filaDe('18:00', 'Ramón Cauich Dzul')!.querySelector<HTMLElement>('button')!.click();
    await esperarA(() => textoPagina().includes('Capturar diezmo'));
    escribir(document.querySelector('mat-dialog-container input'), '1500.5');
    enDialogo('Capturar')!.click();
    await esperarA(() => db.diezmos.some((d) => d.misaId === 'mi-2'));
    expect(db.diezmos.find((d) => d.misaId === 'mi-2')?.monto).toBe('1500.50');
    await esperarA(() => filaDe('18:00', 'Ramón Cauich Dzul')!.textContent!.includes('$1,500.50'));
  });

  it('valida el monto en el formulario y no llama al servidor', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    filaDe('18:00', 'Ramón Cauich Dzul')!.querySelector<HTMLElement>('button')!.click();
    await esperarA(() => textoPagina().includes('Capturar diezmo'));
    const antes = db.diezmos.length;
    for (const malo of ['-5', '12.345', 'abc']) {
      escribir(document.querySelector('mat-dialog-container input'), malo);
      enDialogo('Capturar')!.click();
      await esperar(10);
      expect(textoPagina()).toContain('Monto no válido');
    }
    escribir(document.querySelector('mat-dialog-container input'), '');
    enDialogo('Capturar')!.click();
    await esperarA(() => textoPagina().includes('Escribe el monto.'));
    expect(db.diezmos).toHaveLength(antes);
  });

  it('acepta 0 como monto (misa sin diezmo)', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    filaDe('18:00', 'Ramón Cauich Dzul')!.querySelector<HTMLElement>('button')!.click();
    await esperarA(() => textoPagina().includes('Capturar diezmo'));
    escribir(document.querySelector('mat-dialog-container input'), '0');
    enDialogo('Capturar')!.click();
    await esperarA(() => db.diezmos.some((d) => d.misaId === 'mi-2'));
    expect(db.diezmos.find((d) => d.misaId === 'mi-2')?.monto).toBe('0.00');
  });

  it('corrige un diezmo y deja el monto anterior en el historial', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    const fila = filas().find((f) => f.textContent?.includes('$2,000.00'))!;
    [...fila.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Corregir')!.click();
    await esperarA(() => textoPagina().includes('Corregir diezmo'));
    // Mismo monto: el servidor lo rechaza y el diálogo sigue abierto con el mensaje
    escribir(document.querySelector('mat-dialog-container input'), '2000');
    enDialogo('Corregir')!.click();
    await esperarA(() => textoPagina().includes('El monto es el mismo'));
    escribir(document.querySelector('mat-dialog-container input'), '2100.25');
    enDialogo('Corregir')!.click();
    await esperarA(() => db.correcciones.some((c) => c.diezmoId === 'di-4'));
    expect(db.diezmos.find((d) => d.id === 'di-4')?.monto).toBe('2100.25');
    await esperarA(() => textoPagina().includes('$2,100.25'));

    const nueva = filas().find((f) => f.textContent?.includes('$2,100.25'))!;
    [...nueva.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Historial')!
      .click();
    await esperarA(() => textoPagina().includes('Historial del diezmo'));
    await esperarA(() => textoPagina().includes('Correcciones'));
    expect(textoPagina()).toContain('$2,000.00');
    expect(textoPagina()).toContain('$2,100.25');
    expect(textoPagina()).toContain('Jorge Canul');
  });

  it('el historial de una misa con una corrección anterior la lista', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    const fila = filas().find((f) => f.textContent?.includes('$800.00'))!;
    [...fila.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Historial')!
      .click();
    await esperarA(() => textoPagina().includes('Correcciones'));
    expect(textoPagina()).toContain('$700.00');
  });
});

describe('diezmo: permisos y alcance', () => {
  it('el administrador consulta pero no captura ni corrige', async () => {
    await abrirApp(TODO, { como: 'admin@iglesia.local' });
    await esperarA(() => filas().length > 0);
    expect(conTexto('Capturar')).toBeUndefined();
    expect(conTexto('Corregir')).toBeUndefined();
    // Pero sí registra misas y ve el historial
    expect(conTexto(/Registrar misa/)).toBeTruthy();
    expect(conTexto('Historial')).toBeTruthy();
  });

  it('el tesorero no registra misas (solo las consulta y captura)', async () => {
    await abrirApp(TODO, { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas().length > 0);
    expect(conTexto(/Registrar misa/)).toBeUndefined();
  });

  it('el menú muestra «Diezmo» al tesorero y al administrador, no al secretario', async () => {
    await abrirApp('/', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('Donaciones'));
    expect(textoPagina()).toContain('Diezmo');
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    await abrirApp('/', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Miembros'));
    expect(textoPagina()).not.toContain('Diezmo');
  });

  it('el secretario es enviado a «sin acceso»', async () => {
    const { router } = await abrirApp('/diezmo', { como: 'secretario@iglesia.local' });
    await esperarA(() => router.url.startsWith('/sin-acceso'));
  });

  it('la Coordinación no ve el diezmo: ni menú ni ruta', async () => {
    const { router } = await abrirApp('/diezmo', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => router.url.startsWith('/sin-acceso'));
    expect(textoPagina()).not.toContain('Capturar');
  });

  it('el tesorero de otra iglesia solo ve el diezmo de la suya', async () => {
    await abrirApp(TODO, { como: 'tesorero2@iglesia.local' });
    await esperarA(() => textoPagina().includes('$99,999.00'));
    expect(filas()).toHaveLength(1);
    expect(textoPagina()).not.toContain('$1,250.50');
  });
});

describe('diezmo: registrar misa', () => {
  it('el administrador registra una misa con un padre nuevo', async () => {
    await abrirApp(TODO, { como: 'admin@iglesia.local' });
    await esperarA(() => filas().length > 0);
    const antes = db.misas.length;
    conTexto(/Registrar misa/)!.click();
    await esperarA(() => textoPagina().includes('Registrar misa celebrada'));

    // Agrega un padre al vuelo
    escribir(
      [...document.querySelectorAll<HTMLInputElement>('mat-dialog-container input')].find(
        (i) => i.type === 'text',
      )!,
      'Pedro Nuevo',
    );
    await esperar(10);
    enDialogo('Agregar')!.click();
    await esperarA(() => db.padres.some((p) => p.nombre === 'Pedro Nuevo'));

    const inicio = document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    escribir(inicio, '2026-01-04T09:30');
    enDialogo('Registrar')!.click();
    await esperarA(() => db.misas.length === antes + 1);
    const nueva = db.misas.at(-1)!;
    expect(nueva.iglesiaId).toBe('ig-comunidad');
    expect(db.padres.find((p) => p.id === nueva.padreId)?.nombre).toBe('Pedro Nuevo');
  });

  it('rechaza una fecha futura sin llamar al servidor', async () => {
    await abrirApp(TODO, { como: 'admin@iglesia.local' });
    await esperarA(() => filas().length > 0);
    const antes = db.misas.length;
    conTexto(/Registrar misa/)!.click();
    await esperarA(() => textoPagina().includes('Registrar misa celebrada'));
    await esperarA(() => enDialogo('Registrar') !== undefined);
    escribir(document.querySelector('input[type="datetime-local"]'), '2999-01-01T10:00');
    enDialogo('Registrar')!.click();
    await esperarA(() => textoPagina().includes('Solo se registra una misa que ya se celebró.'));
    expect(db.misas).toHaveLength(antes);
  });
});

describe('diezmo: reportes', () => {
  const REPORTES = '/diezmo?tab=reportes&rdesde=2000-01-01&rhasta=2999-12-31&agrupar=padre';

  it('muestra total, promedio, misas con más y menos diezmo', async () => {
    await abrirApp(REPORTES, { como: 'admin@iglesia.local' });
    // 1250.50 + 800 + 2000 + 500 = 4550.50 en 4 misas → promedio 1137.63 (redondeo al centavo)
    await esperarA(() => textoPagina().includes('Total del periodo'));
    await esperarA(() => textoPagina().includes('$4,550.50'));
    expect(textoPagina()).toContain('Misa con más diezmo');
    expect(textoPagina()).toContain('$2,000.00');
    expect(textoPagina()).toContain('$500.00');
    expect(textoPagina()).toContain('$1,137.63');
    // No suma la otra iglesia
    expect(textoPagina()).not.toContain('99,999');
  });

  it('agrupa por padre con tabla accesible y sumas exactas', async () => {
    await abrirApp(REPORTES, { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('Luis Pérez Cámara'));
    // Luis: 1250.50 + 800 + 500 = 2550.50 · Ramón: 2000
    const texto = textoPagina();
    expect(texto).toContain('Luis Pérez Cámara');
    expect(texto).toContain('Ramón Cauich Dzul');
    expect(texto).toContain('$2,550.50');
  });

  it('muestra el estado vacío sin diezmo en el periodo', async () => {
    await abrirApp('/diezmo?tab=reportes&rdesde=2000-01-01&rhasta=2000-01-31', {
      como: 'tesorero@iglesia.local',
    });
    await esperarA(() => textoPagina().includes('Sin diezmo capturado en este periodo'));
  });
});
