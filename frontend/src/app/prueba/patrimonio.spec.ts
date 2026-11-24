// E2-14 y E2-15 (Nataly): consultas públicas, iglesias del panel, patrimonio y criterios del índice.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { indiceDeIglesia } from '@/mocks/handlers/patrimonio';
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
const campo = (etiqueta: string, dentro = 'mat-dialog-container') =>
  [...document.querySelectorAll(`${dentro} mat-form-field`)].find((c) =>
    c.querySelector('mat-label')?.textContent?.trim().startsWith(etiqueta),
  );
const inputDe = (etiqueta: string, dentro?: string) =>
  campo(etiqueta, dentro)?.querySelector<HTMLInputElement>('input, textarea') ?? null;

/** Abre el mat-select con esa etiqueta y elige la opción. */
async function elegir(etiqueta: string, opcion: string, dentro?: string) {
  campo(etiqueta, dentro)!.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
  await esperarA(() => opciones().some((o) => o.textContent?.trim() === opcion));
  opciones()
    .find((o) => o.textContent?.trim() === opcion)!
    .click();
  await esperarA(() => opciones().length === 0);
}

const indiceParroquia = () => indiceDeIglesia('ig-comunidad');

describe('consultas públicas (E2-14)', () => {
  it('sin estado elegido pide elegir uno, sin sesión', async () => {
    await abrirApp('/templos');
    await esperarA(() => textoPagina().includes('Elige un estado'));
    expect(textoPagina()).toContain('Iglesias de México');
  });

  it('CA-02: las iglesias activas del estado con su distinción; no la cerrada', async () => {
    await abrirApp('/templos?estado=21');
    await esperarA(() => textoPagina().includes('Templo de Santo Domingo'));
    expect(textoPagina()).toContain('Parroquia Comunidad de Fe');
    expect(textoPagina()).toContain('Alto valor patrimonial');
    expect(textoPagina()).toContain('Patrimonio sobresaliente');
    expect(textoPagina()).not.toContain('Templo de San Roque');
    expect(textoPagina()).not.toContain('Catedral de San Ildefonso');
  });

  it('CA-03: acota por tipo y por municipio', async () => {
    await abrirApp('/templos?estado=21&tipo=CAPILLA');
    await esperarA(() => textoPagina().includes('Capilla de la Tercera Orden'));
    expect(textoPagina()).not.toContain('Templo de Santo Domingo');
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    await abrirApp('/templos?estado=21&municipio=21114');
    await esperarA(() => textoPagina().includes('Templo de Santo Domingo'));
    expect(textoPagina()).not.toContain('Capilla de la Tercera Orden');
  });

  it('una búsqueda sin resultados muestra el estado vacío', async () => {
    await abrirApp('/templos?estado=09');
    await esperarA(() => textoPagina().includes('No hay iglesias con esos filtros'));
  });

  it('CA-04: la ficha muestra datos, objetos vigentes, índice 35.5 y su distinción', async () => {
    await abrirApp('/templos/ig-comunidad');
    await esperarA(() => textoPagina().includes('Parroquia Comunidad de Fe'));
    expect(textoPagina()).toContain('35.5');
    expect(textoPagina()).toContain('Alto valor patrimonial');
    expect(textoPagina()).toContain('Imagen de San Miguel Arcángel');
    expect(textoPagina()).toContain('siglo XVIII');
    expect(textoPagina()).toContain('Catalogado por el INAH');
    expect(textoPagina()).toContain('Caben 400 personas');
    // El cáliz dado de baja no se muestra (RN-11)
    expect(textoPagina()).not.toContain('Cáliz antiguo');
  });

  it('la ficha de una iglesia cerrada no existe para el público', async () => {
    await abrirApp('/templos/ig-cerrada');
    await esperarA(() => textoPagina().includes('La iglesia no existe.'));
  });

  it('CA-06: el ranking va de mayor a menor índice, sin cerradas ni iglesias sin objetos', async () => {
    await abrirApp('/reconocidas?estado=21');
    await esperarA(() => textoPagina().includes('Templo de Santo Domingo'));
    const texto = textoPagina();
    expect(texto.indexOf('Templo de Santo Domingo')).toBeLessThan(
      texto.indexOf('Parroquia Comunidad de Fe'),
    );
    expect(texto).not.toContain('Templo de San Roque');
    expect(texto).not.toContain('Capilla de la Tercera Orden');
  });

  it('CA-08: imágenes de 300 años o más en Puebla, con los objetos que cumplen', async () => {
    await abrirApp('/busqueda-patrimonio?estado=21');
    await esperarA(() => textoPagina().includes('Templo de Santo Domingo'));
    expect(textoPagina()).toContain('Cristo de la Columna (1650');
    expect(textoPagina()).not.toContain('Catedral de San Ildefonso');
    expect(textoPagina()).not.toContain('Templo de San Roque');
  });
});

describe('iglesias en el panel (E2-15)', () => {
  it('la Coordinación ve ubicación y situación, incluidas las cerradas (RF-12)', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Templo de San Roque'));
    expect(textoPagina()).toContain('Heroica Puebla de Zaragoza, Puebla');
    expect(textoPagina()).toContain('Cerrada');
    expect(textoPagina()).toContain('Daños por sismo');
  });

  it('edita una iglesia: al cambiar el estado se vuelve a elegir el municipio (RF-09)', async () => {
    await abrirApp('/iglesias?q=Tercera', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => conTexto('Editar') !== undefined);
    conTexto('Editar')!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    await esperarA(() => campo('Municipio')?.textContent?.includes('Atlixco') === true);
    await elegir('Estado', 'Yucatán');
    await esperarA(() => !campo('Municipio')?.textContent?.includes('Atlixco'));
    await elegir('Municipio', 'Mérida');
    escribir(inputDe('Capacidad'), '150');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.iglesias.find((i) => i.id === 'ig-atlixco')?.estado?.clave === '31');
    const editada = db.iglesias.find((i) => i.id === 'ig-atlixco');
    expect(editada).toMatchObject({
      capacidad: 150,
      municipio: { clave: '31050' },
      localidad: null,
    });
  });

  it('valida latitud y longitud juntas sin llamar al servidor', async () => {
    await abrirApp('/iglesias', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => conTexto(/Nueva iglesia/) !== undefined);
    conTexto(/Nueva iglesia/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    const antes = db.iglesias.length;
    escribir(inputDe('Nombre'), 'Templo nuevo');
    await elegir('Tipo', 'Templo');
    escribir(inputDe('Latitud'), '19.5');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Escribe latitud y longitud juntas.'));
    expect(db.iglesias).toHaveLength(antes);
  });

  it('cierra una iglesia con fecha y motivo (RF-11)', async () => {
    await abrirApp('/iglesias?q=Tercera', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => conTexto('Cerrar') !== undefined);
    conTexto('Cerrar')!.click();
    await esperarA(() => enDialogo('Cerrar iglesia') !== undefined);
    enDialogo('Cerrar iglesia')!.click();
    await esperarA(() => textoPagina().includes('Escribe el motivo del cierre.'));
    escribir(inputDe('Motivo'), 'Desuso');
    enDialogo('Cerrar iglesia')!.click();
    await esperarA(() => db.iglesias.find((i) => i.id === 'ig-atlixco')?.activa === false);
    expect(db.iglesias.find((i) => i.id === 'ig-atlixco')?.motivoCierre).toBe('Desuso');
  });
});

describe('patrimonio de la iglesia (E2-15)', () => {
  it('el administrador ve sus objetos, su índice y su distinción', async () => {
    await abrirApp('/patrimonio', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Piano vertical'));
    expect(textoPagina()).toContain('35.5');
    expect(textoPagina()).toContain('Alto valor patrimonial');
    expect(textoPagina()).toContain('4 de 5');
    expect(textoPagina()).toContain('Dado de baja');
  });

  it('RN-10: sin año ni siglo no deja guardar; con el siglo sí', async () => {
    await abrirApp('/patrimonio', { como: 'admin@iglesia.local' });
    await esperarA(() => conTexto(/Nuevo objeto/) !== undefined);
    conTexto(/Nuevo objeto/)!.click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    const antes = db.objetos.length;
    escribir(inputDe('¿Qué es?'), 'Pintura de San José');
    await elegir('Tipo', 'Pintura');
    escribir(inputDe('Material'), 'Óleo sobre tela');
    escribir(inputDe('Estado de conservación'), 'Bueno');
    escribir(inputDe('Ubicación en el templo'), 'Nave lateral');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Escribe el año o, si no se conoce, el siglo.'));
    expect(db.objetos).toHaveLength(antes);

    escribir(inputDe('Siglo'), '17');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.objetos.length === antes + 1);
    expect(db.objetos.at(-1)).toMatchObject({ siglo: 17, anio: null, tipo: 'PINTURA' });
    await esperarA(() => textoPagina().includes('siglo XVII'));
  });

  it('CA-05: con el piano prestado el índice baja a 33.1', async () => {
    await abrirApp('/patrimonio', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Piano vertical'));
    const fila = [...document.querySelectorAll('tr')].find((tr) =>
      tr.textContent?.includes('Piano vertical'),
    )!;
    [...fila.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Cambiar estado'))!
      .click();
    await esperarA(() => enDialogo('Guardar') !== undefined);
    await elegir('Nuevo estado', 'Prestado');
    escribir(inputDe('Motivo'), 'Exposición en el museo');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.objetos.find((o) => o.id === 'ob-piano')?.estado === 'PRESTADO');
    expect(indiceParroquia().indice).toBe(33.1);
    await esperarA(() => textoPagina().includes('33.1'));
  });

  it('la Coordinación consulta el patrimonio de una iglesia cerrada sin poder capturar', async () => {
    await abrirApp('/iglesias/ig-cerrada/patrimonio', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Retablo mayor'));
    expect(textoPagina()).toContain('Iglesia cerrada');
    expect(conTexto(/Nuevo objeto/)).toBeUndefined();
    expect(conTexto('Cambiar estado')).toBeUndefined();
  });

  it('una iglesia sin objetos muestra el estado vacío', async () => {
    await abrirApp('/iglesias/ig-otra/patrimonio', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Sin objetos registrados'));
  });

  it('el tesorero no entra al patrimonio', async () => {
    const { router } = await abrirApp('/patrimonio', { como: 'tesorero@iglesia.local' });
    await esperarA(() => router.url.startsWith('/sin-acceso'));
  });
});

describe('criterios del índice (E2-15, RF-22)', () => {
  it('CA-07: la Coordinación cambia los puntos del INAH a 10 y el índice pasa a 40.5', async () => {
    await abrirApp('/criterios-indice', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => inputDe('Puntos que suma', 'app-criterios')?.value === '5');
    escribir(inputDe('Puntos que suma', 'app-criterios'), '10');
    conTexto('Guardar criterios')!.click();
    await esperarA(() => db.criterios.length === 1);
    expect(db.criterios[0]?.puntosInah).toBe(10);
    expect(indiceParroquia()).toMatchObject({
      indice: 40.5,
      distincion: 'Patrimonio sobresaliente',
    });
    await esperarA(() => textoPagina().includes('Vigentes desde'));
  });

  it('no deja guardar un multiplicador con dos decimales', async () => {
    await abrirApp('/criterios-indice', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => inputDe('Imágenes', 'app-criterios')?.value === '1.5');
    escribir(inputDe('Imágenes', 'app-criterios'), '1.55');
    conTexto('Guardar criterios')!.click();
    await esperarA(() => textoPagina().includes('Un decimal como máximo.'));
    expect(db.criterios).toHaveLength(0);
  });

  it('el administrador de una iglesia no ve los criterios', async () => {
    const { router } = await abrirApp('/criterios-indice', { como: 'admin@iglesia.local' });
    await esperarA(() => router.url.startsWith('/sin-acceso'));
  });
});

describe('pendientes de la integración (PR #26, #27 y #23)', () => {
  it('RF-08: el encargado edita los datos de su iglesia desde Patrimonio', async () => {
    await abrirApp('/patrimonio', { como: 'admin@iglesia.local' });
    await esperarA(() => conTexto(/Editar datos de la iglesia/) !== undefined);
    conTexto(/Editar datos de la iglesia/)!.click();
    await esperarA(() => inputDe('Capacidad')?.value === '400');
    escribir(inputDe('Capacidad'), '450');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.iglesias.find((i) => i.id === 'ig-comunidad')?.capacidad === 450);
  });

  it('la ficha muestra los tipos de espacio de Oscar y enlaza a la solicitud', async () => {
    await abrirApp('/templos/ig-comunidad');
    await esperarA(() => textoPagina().includes('Esta iglesia ofrece'));
    expect(textoPagina()).toContain('cripta y nicho');
    const enlace = [...document.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Solicitar un espacio'),
    );
    expect(enlace?.getAttribute('href')).toBe('/espacios/ig-comunidad');
  });
});
