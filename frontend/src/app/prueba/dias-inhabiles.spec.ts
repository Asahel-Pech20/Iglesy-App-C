// E3-25 (Genaro): días inhábiles. El administrador marca una fecha sin misa u otra hora; la semana
// armada y la ficha pública lo muestran. Supuesto P-33.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { IGLESIA_MOCK } from '@/mocks/datos/b1';
import { abrirApp, escribir, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const DIA = 86_400_000;
const botones = () => [...document.querySelectorAll<HTMLElement>('button, a')];
const boton = (texto: string) => botones().find((b) => b.textContent?.trim() === texto);
const enDialogo = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')].find(
    (b) => b.textContent?.trim() === texto,
  );
const opciones = () => [...document.querySelectorAll<HTMLElement>('mat-option')];
const campo = (etiqueta: string) =>
  [...document.querySelectorAll('mat-dialog-container mat-form-field')].find((c) =>
    c.textContent?.includes(etiqueta),
  );
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

/** Domingo de la semana en curso (hoy o antes), «yyyy-MM-dd» */
function domingoDeEstaSemana() {
  const d = new Date();
  while (d.getUTCDay() !== 0) d.setTime(d.getTime() - DIA);
  return d.toISOString().slice(0, 10);
}

/** Domingo dentro de `semanas` semanas (negativo = en el pasado), «yyyy-MM-dd» */
function domingoEn(semanas: number) {
  const d = new Date(Date.now() + semanas * 7 * DIA);
  while (d.getUTCDay() !== 0) d.setTime(d.getTime() + DIA);
  return d.toISOString().slice(0, 10);
}

function excepcion(fecha: string, tipo: 'SIN_MISA' | 'OTRA_HORA', motivo: string) {
  db.excepcionesMisa.push({
    id: `ex-${fecha}`,
    iglesiaId: IGLESIA_MOCK,
    horarioMisaId: 'hm-dom',
    fecha,
    tipo,
    horaNueva: tipo === 'OTRA_HORA' ? '12:00' : null,
    motivo,
    registradoPor: { id: 'u-admin', nombre: 'Admin' },
    createdAt: new Date().toISOString(),
  });
}

describe('E3-25: días sin misa u otra hora', () => {
  it('el administrador marca un domingo sin misa y aparece en la lista', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Días sin misa o con otra hora'));
    boton('Marcar día')!.click();
    await esperarA(() => campo('Misa del horario') !== undefined);
    await elegir('Misa del horario', 'Domingo 10:00');
    escribir(inputDe('Fecha'), domingoEn(1));
    escribir(inputDe('Motivo'), 'Templo cerrado por reparación.');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.excepcionesMisa.length === 1);
    expect(db.excepcionesMisa[0]).toMatchObject({
      horarioMisaId: 'hm-dom',
      fecha: domingoEn(1),
      tipo: 'SIN_MISA',
      horaNueva: null,
    });
    await esperarA(() => filas('Días sin misa o con otra hora').length === 1);
    expect(textoPagina()).toContain('Templo cerrado por reparación.');
  });

  it('valida que la fecha caiga en el día de la misa y pide la hora nueva', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => boton('Marcar día') !== undefined);
    boton('Marcar día')!.click();
    await esperarA(() => campo('Misa del horario') !== undefined);
    await elegir('Misa del horario', 'Domingo 10:00');
    const lunes = new Date(new Date(`${domingoEn(1)}T12:00:00Z`).getTime() + DIA)
      .toISOString()
      .slice(0, 10);
    escribir(inputDe('Fecha'), lunes);
    await elegir('Qué pasa ese día', 'Se celebra a otra hora');
    escribir(inputDe('Motivo'), 'Fiesta patronal.');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('La fecha debe ser domingo'));
    expect(textoPagina()).toContain('Indica la hora nueva.');
    expect(db.excepcionesMisa).toHaveLength(0);
  });

  it('la semana armada muestra el día sin misa y el tesorero no ve el botón', async () => {
    // abrirApp reinicia la base simulada: la excepción se agrega después y se vuelve a la página
    const { router } = await abrirApp('/servicios', { como: 'admin@iglesia.local' });
    excepcion(domingoDeEstaSemana(), 'SIN_MISA', 'Peregrinación diocesana.');
    await router.navigateByUrl('/misas?tab=celebradas');
    await esperarA(() => textoPagina().includes('Sin misa (día inhábil)'));
    expect(textoPagina()).toContain('Peregrinación diocesana.');

    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    await abrirApp('/misas', { como: 'tesorero@iglesia.local' });
    await esperarA(() => textoPagina().includes('Días sin misa o con otra hora'));
    expect(boton('Marcar día')).toBeUndefined();
  });

  it('la ficha pública muestra los cambios al horario', async () => {
    const { router } = await abrirApp('/');
    excepcion(domingoEn(1), 'OTRA_HORA', 'Misa de confirmaciones con el obispo.');
    await router.navigateByUrl(`/templos/${IGLESIA_MOCK}`);
    await esperarA(() => textoPagina().includes('Cambios al horario'));
    expect(textoPagina()).toContain('la misa será a las 12:00');
    expect(textoPagina()).toContain('Misa de confirmaciones con el obispo.');
  });
});
