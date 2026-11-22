import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { textoVariacion } from '@/app/features/donaciones/formato-donacion';
import { nombreDeContentDisposition } from '@/app/features/reportes/reportes.service';
import { db } from '@/mocks/db';
import { construirDashboard } from '@/mocks/handlers/dashboard';
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
const indicadores = () => document.querySelector('section[aria-label="Indicadores"]');
const tablaAportaciones = () => document.querySelector('table[aria-label="Aportaciones"]');
const filasTabla = () =>
  document.querySelectorAll('table[aria-label="Aportaciones"] tr.mat-mdc-row');

describe('indicadores del dashboard (F4-06)', () => {
  it('saluda al usuario y muestra los indicadores con enlace a su módulo', async () => {
    await abrirApp('/', { como: 'pastor@iglesia.local' });
    await esperarA(() => indicadores()?.textContent?.includes('Miembros activos') === true);
    expect(document.querySelector('h1')?.textContent).toMatch(
      /(Buenos días|Buenas tardes|Buenas noches), Pastor Daniel Ruiz/,
    );
    await esperarA(() => indicadores()?.textContent?.includes('Esta semana:') === true);
    expect(
      indicadores()!.querySelector('a[aria-label="Miembros activos: ir a miembros"]'),
    ).toHaveProperty('pathname', '/miembros');
    expect(indicadores()!.textContent).toContain('Ministerios');
  });

  it('con ingresos: la tarjeta muestra el total del mes y la variación', async () => {
    await abrirApp('/', { como: 'tesorero@iglesia.local' });
    await esperarA(() => indicadores()?.textContent?.includes('Ingresos del mes') === true);
    expect(indicadores()!.textContent).toContain('$4,620.50');
    expect(indicadores()!.textContent).toMatch(/\+20\.0 % vs\. mes anterior/);
    expect(
      indicadores()!.querySelector('a[aria-label="Ingresos del mes: ir a donaciones"]'),
    ).toHaveProperty('pathname', '/donaciones');
  });

  it('SECRETARIO no ve ingresos: ni tarjeta, ni gráfica, ni hueco', async () => {
    await abrirApp('/', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Asistencia semanal'));
    await esperarA(() => indicadores()?.textContent?.includes('Miembros activos') === true);
    expect(textoPagina()).not.toContain('Ingresos del mes');
    expect(textoPagina()).not.toContain('Ingresos por mes');
    expect(textoPagina()).not.toContain('$');
    expect(indicadores()!.querySelectorAll('a')).toHaveLength(3);
  });

  it('COORDINADOR tampoco ve ingresos', async () => {
    await abrirApp('/', { como: 'coordinador@iglesia.local' });
    await esperarA(() => textoPagina().includes('Asistencia semanal'));
    expect(textoPagina()).not.toContain('Ingresos del mes');
  });

  it('el simulador omite `ingresos` sin donaciones:leer y lo incluye con permiso', () => {
    expect('ingresos' in construirDashboard(false)).toBe(false);
    expect(construirDashboard(true).ingresos?.porMes).toHaveLength(12);
  });
});

describe('gráficas y avisos del dashboard (F4-07, F4-08)', () => {
  it('cada gráfica tiene título, descripción y se puede ver como tabla', async () => {
    await abrirApp('/', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Miembros por ministerio'));
    for (const titulo of [
      'Asistencia semanal',
      'Miembros por ministerio',
      'Altas de miembros por mes',
      'Ingresos por mes',
    ]) {
      expect(textoPagina()).toContain(titulo);
    }
    expect(textoPagina()).toMatch(/Presentes por semana en las últimas 12 semanas/);

    const boton = () =>
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Ver como tabla: Miembros por ministerio"]',
      )!;
    boton().click();
    await esperarA(
      () => document.querySelector('table[aria-label="Datos de Miembros por ministerio"]') !== null,
    );
    expect(
      document.querySelector('table[aria-label="Datos de Miembros por ministerio"]')?.textContent,
    ).toContain('Jóvenes');
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Ver como gráfica: Miembros por ministerio"]',
      )!
      .click();
    await esperarA(
      () => document.querySelector('table[aria-label="Datos de Miembros por ministerio"]') === null,
    );
  });

  it('lista los próximos eventos y los avisos importantes con "Ver todos"', async () => {
    await abrirApp('/', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Semana de ayuno y oración'));
    expect(document.querySelector('ul[aria-label="Próximos eventos"] li')).not.toBeNull();
    const enlaces = [...document.querySelectorAll('aside a')]
      .filter((a) => a.textContent?.trim() === 'Ver todos')
      .map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/eventos', '/anuncios']);
  });
});

describe('listado de aportaciones (F4-01)', () => {
  it('muestra las del mes con el total del filtro y sin anuladas', async () => {
    await abrirApp('/donaciones', { como: 'tesorero@iglesia.local' });
    await esperarA(() => tablaAportaciones() !== null);
    expect(filasTabla()).toHaveLength(4);
    expect(tablaAportaciones()!.textContent).toContain('José Chan May');
    expect(tablaAportaciones()!.textContent).toContain('Anónimo');
    expect(tablaAportaciones()!.textContent).not.toContain('Anulada');
    // 1500.00 + 320.50 + 2000.00 + 800.00
    await esperarA(() => textoPagina().includes('$4,620.50'));
  });

  it('las anuladas se muestran tachadas con su badge y no suman en el total', async () => {
    await abrirApp('/donaciones', { como: 'admin@iglesia.local' });
    await esperarA(() => tablaAportaciones() !== null);
    const casilla = [...document.querySelectorAll('mat-checkbox')]
      .find((c) => c.textContent?.includes('Incluir anuladas'))!
      .querySelector('input')!;
    casilla.click();
    await esperarA(() => filasTabla().length === 5);
    expect(tablaAportaciones()!.textContent).toContain('Anulada');
    expect(
      [...tablaAportaciones()!.querySelectorAll('.anulada')].some((e) =>
        e.textContent?.includes('Luis Aké Novelo'),
      ),
    ).toBe(true);
    expect(textoPagina()).toContain('$4,620.50');
  });

  it('PASTOR (solo lectura) ve el listado pero no "Registrar aportación"', async () => {
    await abrirApp('/donaciones', { como: 'pastor@iglesia.local' });
    await esperarA(() => tablaAportaciones() !== null);
    expect(conTexto('Registrar aportación')).toBeUndefined();
  });

  it('SECRETARIO y COORDINADOR no entran a /donaciones (403)', async () => {
    const { router } = await abrirApp('/donaciones', { como: 'secretario@iglesia.local' });
    expect(router.url).toBe('/sin-acceso');
    expect(tablaAportaciones()).toBeNull();
  });

  it('estado vacío con acción para quien puede registrar', async () => {
    const { router } = await abrirApp('/', { como: 'tesorero@iglesia.local' });
    db.donaciones = [];
    await router.navigateByUrl('/donaciones');
    await esperarA(() => textoPagina().includes('No hay aportaciones en este periodo'));
    expect(conTexto('Registrar aportación')).toBeDefined();
  });
});

describe('registrar y anular aportación (F4-02, F4-03)', () => {
  it('valida los campos obligatorios antes de enviar', async () => {
    await abrirApp('/donaciones', { como: 'tesorero@iglesia.local' });
    await esperarA(() => conTexto('Registrar aportación') !== undefined);
    conTexto('Registrar aportación')!.click();
    await esperarA(() => enDialogo('Registrar') !== undefined);
    enDialogo('Registrar')!.click();
    await esperarA(() => textoPagina().includes('Escribe el monto.'));
    expect(textoPagina()).toContain('Elige el donante o marca la aportación como anónima.');
  });

  it('el interruptor anónima oculta el selector de donante y guarda sin miembro', async () => {
    await abrirApp('/donaciones', { como: 'tesorero@iglesia.local' });
    const antes = db.donaciones.length;
    await esperarA(() => conTexto('Registrar aportación') !== undefined);
    conTexto('Registrar aportación')!.click();
    await esperarA(() => enDialogo('Registrar') !== undefined);
    const dialogo = document.querySelector('mat-dialog-container')!;
    expect(dialogo.querySelector('app-selector-miembros')).not.toBeNull();

    dialogo.querySelector<HTMLButtonElement>('button[role=switch]')!.click();
    await esperarA(() => dialogo.querySelector('app-selector-miembros') === null);

    escribir(dialogo.querySelector('input[formcontrolname=monto]'), '250');
    enDialogo('Registrar')!.click();
    await esperarA(() => db.donaciones.length === antes + 1);
    expect(db.donaciones.at(-1)).toMatchObject({
      monto: '250.00',
      miembroId: null,
      anonima: true,
      concepto: 'DIEZMO',
      registradoPorId: 'u-tesorero',
    });
  });

  it('anular exige motivo y deja la aportación registrada como anulada', async () => {
    await abrirApp('/donaciones', { como: 'tesorero@iglesia.local' });
    await esperarA(() => tablaAportaciones() !== null);
    document
      .querySelector<HTMLButtonElement>(
        'table[aria-label="Aportaciones"] button[aria-label^="Ver detalle"]',
      )!
      .click();
    await esperarA(() => conTexto('Anular') !== undefined);
    conTexto('Anular')!.click();
    await esperarA(
      () =>
        enDialogo('Anular') !== undefined &&
        document.querySelector('mat-dialog-container textarea') !== null,
    );
    const confirmar = enDialogo('Anular')!;
    expect(confirmar.disabled).toBe(true);
    escribir(document.querySelector('mat-dialog-container textarea'), 'Registrada por error');
    await esperarA(() => !confirmar.disabled);
    confirmar.click();
    await esperarA(() => db.donaciones.some((d) => d.anulada));
    expect(db.donaciones.find((d) => d.anulada && d.motivoAnulacion)).toBeDefined();
  });
});

describe('aportaciones en el perfil del miembro (F2-11)', () => {
  it('quien tiene donaciones:leer ve la pestaña con las aportaciones', async () => {
    await abrirApp('/miembros/m-jose', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('Datos personales'));
    const pestana = [...document.querySelectorAll<HTMLElement>('[role=tab]')].find(
      (t) => t.textContent?.trim() === 'Aportaciones',
    )!;
    pestana.click();
    await esperarA(
      () => document.querySelector('ul[aria-label="Aportaciones del miembro"]') !== null,
    );
    expect(textoPagina()).toContain('Total aportado');
  });

  it('SECRETARIO no ve la pestaña ni pide datos financieros', async () => {
    await abrirApp('/miembros/m-jose', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('Datos personales'));
    expect(
      [...document.querySelectorAll('[role=tab]')].some(
        (t) => t.textContent?.trim() === 'Aportaciones',
      ),
    ).toBe(false);
  });
});

describe('resúmenes de ingresos (F4-04, F4-05)', () => {
  it('el resumen por periodo muestra tabla con totales', async () => {
    await abrirApp('/donaciones?tab=resumen', { como: 'tesorero@iglesia.local' });
    await esperarA(
      () => document.querySelector('table[aria-label="Resumen de ingresos"]') !== null,
    );
    expect(
      document.querySelector('table[aria-label="Resumen de ingresos"] tfoot')?.textContent,
    ).toContain('Total');
  });

  it('el resumen mensual muestra el total y la variación contra el mes anterior', async () => {
    await abrirApp('/donaciones?tab=mensual', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('Aportaciones identificadas'));
    expect(textoPagina()).toContain('Aportaciones anónimas');
    expect(textoPagina()).toContain('Por método de recepción');
  });

  it('formatea la variación', () => {
    expect(textoVariacion(20)).toBe('+20.0 %');
    expect(textoVariacion(-5.3)).toBe('−5.3 %');
  });
});

describe('centro de reportes (F4-09)', () => {
  const tarjetas = () =>
    [...document.querySelectorAll('ul[aria-label="Reportes disponibles"] a')].map((a) =>
      a.getAttribute('href'),
    );

  it('ADMIN_IGLESIA ve los cuatro reportes', async () => {
    await abrirApp('/reportes', { como: 'admin@iglesia.local' });
    await esperarA(() => tarjetas().length > 0);
    expect(tarjetas()).toEqual([
      '/reportes?tipo=miembros',
      '/reportes?tipo=asistencia',
      '/reportes?tipo=ministerios',
      '/reportes?tipo=ingresos',
    ]);
  });

  it('TESORERO solo ve Ingresos', async () => {
    await abrirApp('/reportes', { como: 'tesorero@iglesia.local' });
    await esperarA(() => tarjetas().length > 0);
    expect(tarjetas()).toEqual(['/reportes?tipo=ingresos']);
  });

  it('SECRETARIO no ve Ingresos', async () => {
    await abrirApp('/reportes', { como: 'secretario@iglesia.local' });
    await esperarA(() => tarjetas().length > 0);
    expect(tarjetas()).toHaveLength(3);
    expect(tarjetas()).not.toContain('/reportes?tipo=ingresos');
  });

  it('pedir un reporte sin permiso por la URL muestra "No tienes acceso"', async () => {
    await abrirApp('/reportes?tipo=ingresos', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('No tienes acceso a este reporte'));
    expect(document.querySelector('[role=region][aria-label^="Vista previa"]')).toBeNull();
  });
});

describe('vista previa (F4-10)', () => {
  const vista = () => document.querySelector('[role=region][aria-label^="Vista previa"]');

  it('?tipo=asistencia&desde&hasta (enlace de F3) abre el reporte con esos filtros', async () => {
    await abrirApp('/reportes?tipo=asistencia&desde=2020-01-01&hasta=2030-12-31', {
      como: 'secretario@iglesia.local',
    });
    await esperarA(() => vista() !== null);
    expect(textoPagina()).toContain('Reporte de asistencia');
    expect(vista()!.textContent).toContain('Desde: 01/01/2020');
    expect(vista()!.textContent).toContain('Hasta: 31/12/2030');
    expect(conTexto('Exportar')).toBeDefined();
  });

  it('ingresos: resumen con moneda, tabla y fila de totales', async () => {
    await abrirApp('/reportes?tipo=ingresos&agrupar=concepto', { como: 'tesorero@iglesia.local' });
    await esperarA(() => vista() !== null);
    expect(vista()!.textContent).toMatch(/\$/);
    expect(vista()!.querySelector('table[aria-label*="Resumen por concepto"]')).not.toBeNull();
    expect(vista()!.querySelector('[aria-label="Totales de Resumen por concepto"]')).not.toBeNull();
  });

  it('el filtro inválido del servidor se muestra con Reintentar', async () => {
    await abrirApp('/reportes?tipo=ingresos&desde=2026-05-01&hasta=2026-01-01', {
      como: 'admin@iglesia.local',
    });
    await esperarA(() => textoPagina().includes('Los datos enviados no son válidos.'));
    expect(conTexto('Reintentar')).toBeDefined();
  });

  it('asistencia por evento sin evento elegido pide elegir uno', async () => {
    await abrirApp('/reportes?tipo=asistencia&modo=evento', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Elige un evento'));
  });
});

describe('descarga (F4-09, F4-11)', () => {
  const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click');
  let creada: unknown;

  beforeEach(() => {
    clic.mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn((blob: unknown) => {
      creada = blob;
      return 'blob:prueba';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    creada = undefined;
  });
  afterEach(() => clic.mockReset());

  it('baja el PDF como blob y lo guarda con el nombre de Content-Disposition', async () => {
    await abrirApp('/reportes?tipo=ingresos', { como: 'tesorero@iglesia.local' });
    await esperarA(
      () => document.querySelector('[role=region][aria-label^="Vista previa"]') !== null,
    );
    conTexto('Exportar')!.click();
    await esperarA(() => document.querySelector('[role=menuitem]') !== null);
    [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
      .find((m) => m.textContent?.includes('PDF'))!
      .click();

    await esperarA(() => clic.mock.calls.length === 1);
    const enlace = clic.mock.contexts[0] as HTMLAnchorElement;
    expect(enlace.download).toMatch(/^reporte-ingresos-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(enlace.href).toBe('blob:prueba');
    expect(creada).toBeDefined();
    await esperarA(() => textoPagina().includes('Descargado reporte-ingresos-'));
  });

  it('un error al descargar muestra el mensaje del servidor (el JSON llega dentro de un Blob)', async () => {
    await abrirApp('/reportes?tipo=ingresos&desde=2026-05-01&hasta=2026-01-01', {
      como: 'admin@iglesia.local',
    });
    await esperarA(() => textoPagina().includes('Los datos enviados no son válidos.'));
    conTexto('Exportar')!.click();
    await esperarA(() => document.querySelector('[role=menuitem]') !== null);
    [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
      .find((m) => m.textContent?.includes('Excel'))!
      .click();
    await esperarA(
      () =>
        document
          .querySelector('.mat-mdc-snack-bar-label')
          ?.textContent?.includes('no son válidos') === true,
    );
    expect(clic).not.toHaveBeenCalled();
  });

  it('lee el nombre del archivo de Content-Disposition', () => {
    expect(
      nombreDeContentDisposition('attachment; filename="reporte-miembros-2026-10-30.pdf"'),
    ).toBe('reporte-miembros-2026-10-30.pdf');
    expect(nombreDeContentDisposition("attachment; filename*=UTF-8''reporte%20a%C3%B1o.xlsx")).toBe(
      'reporte año.xlsx',
    );
    expect(nombreDeContentDisposition(null)).toBeNull();
  });
});
