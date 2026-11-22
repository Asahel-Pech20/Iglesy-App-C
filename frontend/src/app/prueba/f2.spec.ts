import { TestBed } from '@angular/core/testing';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectorMiembros } from '@/app/features/miembros/selector-miembros';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperar, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const pestana = (nombre: string) =>
  [...document.querySelectorAll<HTMLElement>('[role=tab]')].find((t) =>
    t.textContent?.includes(nombre),
  );
const enlaceOBoton = (texto: string | RegExp, raiz: ParentNode = document) =>
  [...raiz.querySelectorAll<HTMLElement>('a, button')].find((b) =>
    typeof texto === 'string' ? b.textContent?.trim() === texto : texto.test(b.textContent ?? ''),
  );
const dialogo = () => document.querySelector('mat-dialog-container');
const opciones = () =>
  [...document.querySelectorAll<HTMLElement>('mat-option')].map((o) => o.textContent?.trim());

async function abrirPestana(nombre: string) {
  await esperarA(() => pestana(nombre) !== undefined);
  pestana(nombre)!.click();
  await esperar(20);
}

describe('perfil: asistencia (F2-04)', () => {
  it('muestra el historial, el % de 3 meses y el último evento', async () => {
    await abrirApp('/miembros/m-jose', { como: 'secretario@iglesia.local' });
    await abrirPestana('Asistencia');
    await esperarA(() => textoPagina().includes('Último evento asistido'));
    expect(textoPagina()).toContain('100 %');
    expect(textoPagina()).toContain('1 de 1 eventos');
    await esperarA(() => textoPagina().includes('Presente'));
    expect(textoPagina()).toContain('Culto dominical');
  });

  it('estado vacío sin registros', async () => {
    await abrirApp('/miembros/m-sofia', { como: 'secretario@iglesia.local' });
    await abrirPestana('Asistencia');
    await esperarA(() => textoPagina().includes('Este miembro aún no tiene asistencia registrada'));
    expect(textoPagina()).toContain('Sin registros');
  });

  it('TESORERO no ve la pestaña de asistencia, pero sí la de aportaciones', async () => {
    await abrirApp('/miembros/m-jose', { como: 'tesorero@iglesia.local' });
    await esperarA(() => pestana('Aportaciones') !== undefined);
    expect(pestana('Asistencia')).toBeUndefined();
  });

  it('SECRETARIO no ve la pestaña de aportaciones', async () => {
    await abrirApp('/miembros/m-jose', { como: 'secretario@iglesia.local' });
    await esperarA(() => pestana('Asistencia') !== undefined);
    expect(pestana('Aportaciones')).toBeUndefined();
  });

  it('COORDINADOR ve el historial de sus ministerios, sin el % general', async () => {
    await abrirApp('/miembros/m-jose', { como: 'coordinador@iglesia.local' });
    await abrirPestana('Asistencia');
    await esperarA(() => textoPagina().includes('Este miembro aún no tiene asistencia registrada'));
    expect(textoPagina()).not.toContain('Último evento asistido');
  });
});

describe('perfil: ministerios (F2-05)', () => {
  async function abrirSelect() {
    await esperarA(() => document.querySelector('app-ministerios-del-miembro mat-select') !== null);
    document
      .querySelector<HTMLElement>('app-ministerios-del-miembro .mat-mdc-select-trigger')!
      .click();
    await esperarA(() => opciones().length > 0);
  }

  it('no ofrece ministerios inactivos', async () => {
    await abrirApp('/miembros/m-pedro', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Ministerio al que agregar'));
    await abrirSelect();
    expect(opciones()).toEqual(expect.arrayContaining(['Jóvenes', 'Música', 'Niños']));
    expect(opciones()).not.toContain('Damas');
  });

  it('COORDINADOR solo ve como opción sus ministerios', async () => {
    await abrirApp('/miembros/m-pedro', { como: 'coordinador@iglesia.local' });
    await esperarA(() => textoPagina().includes('Ministerio al que agregar'));
    await abrirSelect();
    expect(opciones()).toEqual(['Jóvenes']);
  });
});

describe('listado de miembros (F2-01, F2-03)', () => {
  it('pulsar la fila abre el perfil; el botón de acciones no', async () => {
    const { router } = await abrirApp('/miembros', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    const fila = [...document.querySelectorAll<HTMLElement>('tr.mat-mdc-row')].find((f) =>
      f.textContent?.includes('José Chan May'),
    )!;
    fila.querySelector<HTMLElement>('td.acciones button')!.click();
    await esperar(20);
    expect(router.url).toBe('/miembros');

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    fila.querySelector<HTMLElement>('td:nth-child(2)')!.click();
    await esperarA(() => router.url === '/miembros/m-jose');
  });

  it('desactivar pide confirmación, guarda el motivo y cierra sus vínculos', async () => {
    await abrirApp('/miembros/m-ana', { como: 'secretario@iglesia.local' });
    await esperarA(() => enlaceOBoton('Desactivar') !== undefined);
    enlaceOBoton('Desactivar')!.click();
    await esperarA(
      () => dialogo()?.textContent?.includes('Se conservará todo su historial') === true,
    );
    escribir(dialogo()!.querySelector('textarea'), 'Cambio de congregación');
    enlaceOBoton('Desactivar', dialogo()!)!.click();
    await esperarA(() => db.miembros.find((m) => m.id === 'm-ana')?.activo === false);
    expect(db.miembros.find((m) => m.id === 'm-ana')?.motivoBaja).toBe('Cambio de congregación');
    expect(db.vinculos.some((v) => v.miembroId === 'm-ana' && v.activo)).toBe(false);
  });

  it('TESORERO solo lee: sin "Nuevo miembro"', async () => {
    await abrirApp('/miembros', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    expect(enlaceOBoton(/Nuevo miembro/)).toBeUndefined();
  });
});

describe('ministerios (F2-07, F2-08)', () => {
  it('lista los activos y SECRETARIO no puede crear', async () => {
    await abrirApp('/ministerios', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Jóvenes'));
    expect(textoPagina()).toContain('Coordinación: María Chan');
    expect(textoPagina()).not.toContain('Damas');
    expect(enlaceOBoton(/Nuevo ministerio/)).toBeUndefined();
  });

  it('estado vacío con búsqueda', async () => {
    await abrirApp('/ministerios?q=zzzz', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('No hay ministerios'));
  });

  it('muestra el 409 por nombre duplicado en el campo', async () => {
    await abrirApp('/ministerios', { como: 'admin@iglesia.local' });
    await esperarA(() => enlaceOBoton(/Nuevo ministerio/) !== undefined);
    enlaceOBoton(/Nuevo ministerio/)!.click();
    // El formulario queda conectado cuando ya se dibujó el texto del botón
    await esperarA(() => dialogo() !== null && enlaceOBoton('Guardar', dialogo()!) !== undefined);
    escribir(dialogo()!.querySelector('input[formcontrolname=nombre]'), 'música');
    dialogo()!
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await esperarA(() => textoPagina().includes('Ya existe un ministerio con ese nombre.'));
    expect(db.ministerios.filter((m) => m.nombre.toLowerCase() === 'música')).toHaveLength(1);
  });
});

describe('detalle del ministerio (F2-09, F2-10)', () => {
  it('COORDINADOR del ministerio agrega; de otro ministerio no ve el botón', async () => {
    await abrirApp('/ministerios/min-jovenes', { como: 'coordinador@iglesia.local' });
    await esperarA(() => enlaceOBoton(/Agregar\s+integrantes/) !== undefined);
    document.body.innerHTML = '';
    TestBed.resetTestingModule();

    await abrirApp('/ministerios/min-musica', { como: 'coordinador@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    expect(enlaceOBoton(/Agregar\s+integrantes/)).toBeUndefined();
    expect(enlaceOBoton(/Quitar/)).toBeUndefined();
  });

  it('solo ADMIN_IGLESIA y PASTOR ven "Editar coordinadores"', async () => {
    await abrirApp('/ministerios/min-jovenes', { como: 'pastor@iglesia.local' });
    await esperarA(() => enlaceOBoton(/Editar coordinadores/) !== undefined);
    document.body.innerHTML = '';
    TestBed.resetTestingModule();

    await abrirApp('/ministerios/min-jovenes', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Daniel Cauich Tun'));
    expect(enlaceOBoton(/Editar coordinadores/)).toBeUndefined();
  });
});

describe('SelectorMiembros (F2-06)', () => {
  it('selección múltiple con chips, sin ofrecer a los excluidos', async () => {
    await abrirApp('/miembros', { como: 'admin@iglesia.local' });
    const fixture = TestBed.createComponent(SelectorMiembros);
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('excluirIds', ['m-ana']);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    await esperar();
    const raiz = fixture.nativeElement as HTMLElement;
    const panel = fixture.debugElement
      .query(By.directive(MatAutocompleteTrigger))
      .injector.get(MatAutocompleteTrigger);
    panel.openPanel();
    await esperarA(() => opciones().some((o) => o?.includes('María Pech Canul')));
    expect(opciones().some((o) => o?.includes('Ana Pérez Uc'))).toBe(false);

    for (const [nombre, total] of [
      ['María Pech Canul', 1],
      ['Pedro Euán Ku', 2],
    ] as const) {
      // Elegir una opción cierra el panel
      panel.openPanel();
      await esperarA(() => opciones().some((o) => o?.includes(nombre)));
      [...document.querySelectorAll<HTMLElement>('mat-option')]
        .find((o) => o.textContent?.includes(nombre))!
        .click();
      await esperarA(() => raiz.querySelectorAll('mat-chip').length === total);
    }
    expect(fixture.componentInstance.seleccion()).toEqual(['m-maria', 'm-pedro']);
    fixture.destroy();
  });
});

describe('actividades del ministerio (F2-11)', () => {
  const lista = (etiqueta: string) => document.querySelector(`ul[aria-label="${etiqueta}"]`);

  it('un cancelado futuro va en próximas (con su estado), no en pasadas', async () => {
    db.eventos.find((e) => e.id === 'ev-culto-pasado')!.ministerioId = 'min-jovenes';
    await abrirApp('/ministerios/min-jovenes', { como: 'secretario@iglesia.local' });
    db.eventos.find((e) => e.id === 'ev-culto-pasado')!.ministerioId = 'min-jovenes';
    await abrirPestana('Actividades');
    await esperarA(() => lista('Actividades próximas') !== null);
    const proximas = lista('Actividades próximas')!.textContent;
    expect(proximas).toContain('Convivencia de jóvenes');
    expect(proximas).toContain('Cancelado');
    expect(lista('Actividades pasadas')?.textContent ?? '').not.toContain('Convivencia de jóvenes');
  });

  it('"Nuevo evento" precarga el ministerio para su coordinador', async () => {
    await abrirApp('/ministerios/min-jovenes', { como: 'coordinador@iglesia.local' });
    await abrirPestana('Actividades');
    await esperarA(() => enlaceOBoton(/Nuevo evento/) !== undefined);
    expect(enlaceOBoton(/Nuevo evento/)!.getAttribute('href')).toBe(
      '/eventos/nuevo?ministerioId=min-jovenes',
    );
  });

  it('COORDINADOR de otro ministerio y TESORERO no ven "Nuevo evento"', async () => {
    for (const como of ['coordinador@iglesia.local', 'tesorero@iglesia.local']) {
      await abrirApp('/ministerios/min-musica', { como });
      await abrirPestana('Actividades');
      await esperarA(() => textoPagina().includes('Ensayo de alabanza'));
      expect(enlaceOBoton(/Nuevo evento/)).toBeUndefined();
      document.body.innerHTML = '';
      TestBed.resetTestingModule();
    }
  });

  it('un ministerio inactivo no ofrece "Nuevo evento"', async () => {
    await abrirApp('/ministerios/min-damas', { como: 'admin@iglesia.local' });
    await abrirPestana('Actividades');
    await esperarA(() => textoPagina().includes('No hay actividades programadas.'));
    expect(enlaceOBoton(/Nuevo evento/)).toBeUndefined();
  });
});
