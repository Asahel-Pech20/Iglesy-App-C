// E3-17 y E3-18 (Genaro): servicios y pláticas de la iglesia, y su sección en la ficha pública.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const botones = () => [...document.querySelectorAll<HTMLElement>('button, a')];
const boton = (texto: string) => botones().find((b) => b.textContent?.trim() === texto);
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

async function elegir(etiqueta: string, opcion: string) {
  campo(etiqueta)!.querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
  await esperarA(() => opciones().some((o) => o.textContent?.includes(opcion)));
  opciones()
    .find((o) => o.textContent?.includes(opcion))!
    .click();
  await esperarA(() => opciones().length === 0);
}

describe('servicios de la iglesia (E3-17: RF-30–RF-34)', () => {
  it('lista los servicios con costo, duración y horarios', async () => {
    await abrirApp('/servicios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Servicios de la iglesia').length === 2);
    const [bautizo, confirmacion] = filas('Servicios de la iglesia');
    expect(bautizo!.textContent).toContain('Bautizo');
    expect(bautizo!.textContent).toContain('$350.00');
    expect(bautizo!.textContent).toContain('Sábado 10:00');
    expect(bautizo!.textContent).toContain('Requiere cita');
    expect(confirmacion!.textContent).toContain('Gratuito');
  });

  it('registra un servicio con monto y un día y hora', async () => {
    await abrirApp('/servicios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Servicios de la iglesia').length === 2);
    boton('Nuevo servicio')!.click();
    await esperarA(() => inputDe('Nombre') !== null);
    escribir(inputDe('Nombre'), 'Matrimonio');
    escribir(inputDe('Monto'), '1200');
    enDialogo('Agregar día y hora')!.click();
    await esperarA(() => inputDe('Hora') !== null);
    escribir(inputDe('Hora'), '13:00');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.servicios.some((s) => s.nombre === 'Matrimonio'));
    expect(db.servicios.find((s) => s.nombre === 'Matrimonio')).toMatchObject({
      formaCosto: 'MONTO',
      monto: '1200.00',
      horarios: [{ diaSemana: 0, hora: '13:00' }],
    });
  });

  it('valida el monto según la forma de costo (RN-22)', async () => {
    await abrirApp('/servicios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Servicios de la iglesia').length === 2);
    boton('Nuevo servicio')!.click();
    await esperarA(() => inputDe('Nombre') !== null);
    escribir(inputDe('Nombre'), 'Misa de XV años');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Escribe el monto.'));
    escribir(inputDe('Monto'), '12.345');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Monto no válido'));
    // Con donativo el monto sugerido es opcional
    await elegir('Costo', 'Donativo voluntario');
    await esperarA(() => inputDe('Monto sugerido') !== null);
    escribir(inputDe('Monto sugerido'), '');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.servicios.some((s) => s.nombre === 'Misa de XV años'));
    expect(db.servicios.find((s) => s.nombre === 'Misa de XV años')!.monto).toBeNull();
  });

  it('un nombre repetido se marca en el campo (409)', async () => {
    await abrirApp('/servicios', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Servicios de la iglesia').length === 2);
    boton('Nuevo servicio')!.click();
    await esperarA(() => inputDe('Nombre') !== null);
    escribir(inputDe('Nombre'), 'bautizo');
    escribir(inputDe('Monto'), '100');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Usa otro nombre'));
    expect(db.servicios.filter((s) => s.nombre.toLowerCase() === 'bautizo')).toHaveLength(1);
  });

  it('muestra el estado vacío sin servicios', async () => {
    const { harness } = await abrirApp('/', { como: 'admin@iglesia.local' });
    db.servicios = [];
    await harness.navigateByUrl('/servicios');
    await esperarA(() => textoPagina().includes('Aún no hay servicios'));
  });

  it('el tesorero no entra a servicios', async () => {
    const { router } = await abrirApp('/servicios', { como: 'tesorero@iglesia.local' });
    await esperarA(() => router.url === '/sin-acceso');
  });
});

describe('pláticas de la iglesia (E3-17: RF-36, RF-37)', () => {
  it('lista y registra una plática', async () => {
    await abrirApp('/servicios?tab=platicas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Pláticas de la iglesia').length === 2);
    expect(filas('Pláticas de la iglesia')[0]!.textContent).toContain('Gratuita');
    boton('Nueva plática')!.click();
    await esperarA(() => inputDe('Lugar') !== null);
    await elegir('Tipo', 'Confirmación');
    escribir(inputDe('Lugar'), 'Salón 2');
    escribir(inputDe('Quién la da'), 'Catequistas');
    escribir(inputDe('Hora'), '17:00');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.platicas.some((p) => p.tipo === 'CONFIRMACION'));
    expect(db.platicas.find((p) => p.tipo === 'CONFIRMACION')).toMatchObject({
      lugar: 'Salón 2',
      imparte: 'Catequistas',
      costo: '0.00',
      horarios: [{ diaSemana: 0, hora: '17:00' }],
    });
  });

  it('valida lugar, quién la da y el horario', async () => {
    await abrirApp('/servicios?tab=platicas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Pláticas de la iglesia').length === 2);
    boton('Nueva plática')!.click();
    await esperarA(() => inputDe('Lugar') !== null);
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Escribe dónde es.'));
    expect(textoPagina()).toContain('Escribe quién la da.');
    expect(db.platicas).toHaveLength(2);
  });
});

describe('ficha pública (E3-18: RF-35, RF-38, RF-39, RF-44)', () => {
  it('muestra horario de misas con su padre, servicios y pláticas, sin sesión', async () => {
    await abrirApp('/templos/ig-comunidad');
    await esperarA(() => textoPagina().includes('Horario de misas'));
    const texto = textoPagina();
    expect(texto).toContain('Luis Pérez Cámara');
    expect(texto).toContain('en maya');
    expect(texto).toContain('Bautizo');
    expect(texto).toContain('$350.00');
    expect(texto).toContain('Gratuito');
    expect(texto).toContain('Prebautismal');
    expect(texto).toContain('Prematrimonial');
  });

  it('«¿cuándo son las pláticas de bautizo?»: filtra por tipo (RF-39)', async () => {
    await abrirApp('/templos/ig-comunidad');
    await esperarA(() => textoPagina().includes('¿Cuándo son las pláticas de'));
    await elegir('¿Cuándo son las pláticas de', 'Prebautismal');
    await esperarA(() => !textoPagina().includes('Capilla del Santísimo'));
    expect(textoPagina()).toContain('Salón parroquial');
  });
});
