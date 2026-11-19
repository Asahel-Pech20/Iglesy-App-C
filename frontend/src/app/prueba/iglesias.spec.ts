import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

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

const campoEnDialogo = (etiqueta: string) =>
  [...document.querySelectorAll('mat-dialog-container mat-form-field')].find((c) =>
    c.textContent?.includes(etiqueta),
  );

/** Abre el mat-select cuyo texto de etiqueta incluye `etiqueta` y elige la opción `opcion`. */
async function elegir(etiqueta: string, opcion: string) {
  const campo = [...document.querySelectorAll('mat-dialog-container mat-form-field')].find((c) =>
    c.textContent?.includes(etiqueta),
  )!;
  campo.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
  await esperarA(() => opciones().some((o) => o.textContent?.includes(opcion)));
  opciones()
    .find((o) => o.textContent?.includes(opcion))!
    .click();
  await esperarA(() => opciones().length === 0);
}

describe('inicio de la Coordinación', () => {
  it('no pide el panel de la iglesia: saluda y ofrece sus accesos', async () => {
    await abrirApp('/', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Ver y crear iglesias'));
    expect(textoPagina()).toContain('Bienvenido');
    expect(textoPagina()).toContain('Administrar usuarios');
    expect(textoPagina()).not.toContain('Miembros activos');
    expect(textoPagina()).not.toContain('No se pudo');
  });

  it('el personal de una iglesia sigue viendo su panel', async () => {
    await abrirApp('/', { como: 'pastor@iglesia.local' });
    await esperarA(() => textoPagina().includes('Miembros activos'));
    expect(textoPagina()).not.toContain('Ver y crear iglesias');
  });
});

describe('iglesias', () => {
  it('la Coordinación ve la lista con el tipo de cada una', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Capilla del Valle'));
    expect(textoPagina()).toContain('Parroquia Comunidad de Fe');
    expect(textoPagina()).toContain('Capilla');
    expect(textoPagina()).toContain('America/Mexico_City');
  });

  it('crea una iglesia y aparece en la lista', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Capilla del Valle'));
    conTexto(/Nueva iglesia/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    escribir(document.querySelector('mat-dialog-container input'), 'Santuario del Cerro');
    await elegir('Tipo', 'Santuario');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.iglesias.some((i) => i.nombre === 'Santuario del Cerro'));
    expect(db.iglesias.find((i) => i.nombre === 'Santuario del Cerro')?.tipo).toBe('SANTUARIO');
    await esperarA(() => textoPagina().includes('Santuario del Cerro'));
  });

  it('valida el formulario sin llamar al servidor', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Capilla del Valle'));
    const antes = db.iglesias.length;
    conTexto(/Nueva iglesia/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Escribe el nombre.'));
    expect(textoPagina()).toContain('Elige el tipo de iglesia.');
    expect(db.iglesias).toHaveLength(antes);
  });

  it('un nombre repetido lo rechaza el servidor y el diálogo sigue abierto', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Capilla del Valle'));
    conTexto(/Nueva iglesia/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    escribir(document.querySelector('mat-dialog-container input'), 'capilla del valle');
    await elegir('Tipo', 'Capilla');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Ya existe una iglesia con ese nombre.'));
    expect(db.iglesias).toHaveLength(2);
  });

  it('el administrador de una iglesia no las ve: ni menú ni ruta', async () => {
    const { router } = await abrirApp('/iglesias', { como: 'admin@iglesia.local' });
    await esperarA(() => router.url.startsWith('/sin-acceso'));
    expect(textoPagina()).not.toContain('Nueva iglesia');
  });
});

describe('usuarios con iglesia', () => {
  async function abrirFormulario(como: string) {
    await abrirApp('/usuarios', { como });
    await esperarA(() => conTexto(/Nuevo usuario/) !== undefined);
    conTexto(/Nuevo usuario/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    escribir(document.querySelector('mat-dialog-container input'), 'Persona Nueva');
    escribir(
      document.querySelector('mat-dialog-container input[type="email"]'),
      'nueva@prueba.local',
    );
  }

  it('la Coordinación elige la iglesia del personal que crea', async () => {
    await abrirFormulario('coordinacion@iglesia.local');
    await elegir('Rol', 'Tesorero');
    await esperarA(() => campoEnDialogo('Iglesia') !== undefined);
    await elegir('Iglesia', 'Capilla del Valle');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.usuarios.some((u) => u.email === 'nueva@prueba.local'));
    expect(db.usuarios.find((u) => u.email === 'nueva@prueba.local')?.iglesiaId).toBe('ig-otra');
  });

  it('la Coordinación no puede guardar personal sin iglesia', async () => {
    await abrirFormulario('coordinacion@iglesia.local');
    await elegir('Rol', 'Tesorero');
    await esperarA(() => campoEnDialogo('Iglesia') !== undefined);
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Elige la iglesia del usuario.'));
    expect(db.usuarios.some((u) => u.email === 'nueva@prueba.local')).toBe(false);
  });

  it('a un usuario de la Coordinación no se le pide iglesia', async () => {
    await abrirFormulario('coordinacion@iglesia.local');
    await elegir('Rol', 'Coordinación nacional');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.usuarios.some((u) => u.email === 'nueva@prueba.local'));
    expect(db.usuarios.find((u) => u.email === 'nueva@prueba.local')?.iglesiaId).toBeNull();
  });

  it('el administrador de una iglesia no elige: crea en la suya', async () => {
    await abrirFormulario('admin@iglesia.local');
    await elegir('Rol', 'Secretario');
    expect(textoPagina()).not.toContain('Iglesia *');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.usuarios.some((u) => u.email === 'nueva@prueba.local'));
    expect(db.usuarios.find((u) => u.email === 'nueva@prueba.local')?.iglesiaId).toBe(
      'ig-comunidad',
    );
  });
});
