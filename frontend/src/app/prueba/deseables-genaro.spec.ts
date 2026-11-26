// Deseables de Genaro: RF-84 (semana armada desde el horario) y RF-83 (pláticas por municipio).
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const botones = () => [...document.querySelectorAll<HTMLElement>('button, a')];
const boton = (texto: string | RegExp) =>
  botones().find((b) =>
    typeof texto === 'string' ? b.textContent?.trim() === texto : texto.test(b.textContent ?? ''),
  );
const filasSemana = () => [
  ...document.querySelectorAll('table[aria-label="Misas de la semana"] tbody tr'),
];

describe('RF-84: semana armada desde el horario', () => {
  it('muestra la semana pasada con sus pendientes y las registra de una vez', async () => {
    await abrirApp('/misas?tab=celebradas', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Semana armada desde el horario'));
    await esperarA(() => filasSemana().length > 0);
    // Esperar a que cargue la semana anterior: si la actual ya no tiene futuras (p. ej., el
    // miércoles en la noche), las condiciones de abajo se cumplirían con la semana equivocada.
    // `> span`: los botones de Material tienen spans internos sin texto.
    const rango = () =>
      document.querySelector('nav[aria-label="Semana"] > span')?.textContent ?? '';
    const rangoActual = rango();
    // El paginador de la lista también tiene «Anterior»: se usa el de la navegación de la semana.
    [...document.querySelectorAll<HTMLElement>('nav[aria-label="Semana"] button')]
      .find((b) => b.textContent?.trim() === 'Anterior')!
      .click();
    await esperarA(() => rango() !== rangoActual && filasSemana().length > 0);
    await esperarA(() => filasSemana().every((f) => !f.textContent?.includes('Aún no empieza')));
    await esperarA(() => filasSemana().some((f) => f.textContent?.includes('Pendiente')));
    const pendientes = filasSemana().filter((f) => f.textContent?.includes('Pendiente')).length;
    const antes = db.misas.length;
    boton(/Registrar las pendientes/)!.click();
    await esperarA(() => db.misas.length === antes + pendientes);
    await esperarA(() => filasSemana().every((f) => f.textContent?.includes('Registrada')));
    // Recorre dos semanas y registra; con la suite completa en paralelo pasa de los 5 s por defecto.
  }, 15_000);

  it('el tesorero ve la semana pero no el botón para registrar', async () => {
    await abrirApp('/misas?tab=celebradas', { como: 'tesorero@iglesia.local' });
    await esperarA(() => filasSemana().length > 0);
    expect(boton(/Registrar las pendientes/)).toBeUndefined();
  });
});

describe('RF-83: pláticas de un tipo en un municipio', () => {
  it('muestra las iglesias del municipio con la plática elegida, sin sesión', async () => {
    await abrirApp('/platicas?tipo=PREBAUTISMAL&estado=21&municipio=21114');
    await esperarA(() => textoPagina().includes('Parroquia Comunidad de Fe'));
    expect(textoPagina()).toContain('Miércoles 19:00');
    expect(textoPagina()).toContain('Salón parroquial');
  });

  it('sin pláticas de ese tipo muestra el estado vacío; sin municipio pide elegirlo', async () => {
    await abrirApp('/platicas?tipo=CONFIRMACION&estado=21&municipio=21114');
    await esperarA(() => textoPagina().includes('No hay pláticas de ese tipo en el municipio'));
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    await abrirApp('/platicas');
    await esperarA(() => textoPagina().includes('Elige un estado y un municipio'));
  });
});
