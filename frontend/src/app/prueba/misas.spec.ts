// E3-15 y E3-16 (Genaro): pantallas de misas (horario, padres, celebradas) y agenda del padre.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/mocks/db';
import { abrirApp, escribir, esperar, esperarA, textoPagina } from './entorno';

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

/** Último domingo pasado (al menos una semana atrás), «yyyy-MM-dd» */
function domingoPasado() {
  const d = new Date(Date.now() - 7 * DIA);
  while (d.getUTCDay() !== 0) d.setTime(d.getTime() - DIA);
  return d.toISOString().slice(0, 10);
}

describe('horario semanal de misas (E3-15: RF-42–RF-46)', () => {
  it('el administrador ve el horario con día, hora, tipo, idioma, duración y padre', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Horario semanal de misas').length === 2);
    const [domingo, miercoles] = filas('Horario semanal de misas');
    expect(domingo!.textContent).toContain('Domingo');
    expect(domingo!.textContent).toContain('10:00');
    expect(domingo!.textContent).toContain('Luis Pérez Cámara');
    expect(domingo!.textContent).toContain('1 h');
    expect(miercoles!.textContent).toContain('Maya');
    expect(miercoles!.textContent).toContain('45 min');
  });

  it('programa una misa nueva con su padre', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Horario semanal de misas').length === 2);
    boton('Programar misa')!.click();
    await esperarA(() => campo('Padre que la oficia') !== undefined);
    await elegir('Día', 'Lunes');
    escribir(inputDe('Hora'), '08:00');
    await elegir('Padre que la oficia', 'Ramón Cauich Dzul');
    enDialogo('Guardar')!.click();
    await esperarA(() => db.horariosMisa.length === 4);
    expect(db.horariosMisa.at(-1)).toMatchObject({
      diaSemana: 1,
      hora: '08:00',
      padreId: 'pa-ana',
    });
    await esperarA(() => filas('Horario semanal de misas').length === 3);
  });

  it('si el padre ya tiene una misa que se empalma, dice con cuál choca (RF-45)', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Horario semanal de misas').length === 2);
    boton('Programar misa')!.click();
    await esperarA(() => campo('Padre que la oficia') !== undefined);
    escribir(inputDe('Hora'), '10:30');
    await elegir('Padre que la oficia', 'Luis Pérez Cámara');
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('ya tiene una misa el domingo a las 10:00'));
    expect(db.horariosMisa).toHaveLength(3);
  });

  it('valida hora y padre antes de enviar', async () => {
    await abrirApp('/misas', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Horario semanal de misas').length === 2);
    boton('Programar misa')!.click();
    await esperarA(() => campo('Padre que la oficia') !== undefined);
    enDialogo('Guardar')!.click();
    await esperarA(() => textoPagina().includes('Indica la hora.'));
    expect(textoPagina()).toContain('Elige el padre que la oficia.');
    expect(db.horariosMisa).toHaveLength(3);
  });

  it('el tesorero consulta el horario pero no lo cambia', async () => {
    await abrirApp('/misas', { como: 'tesorero@iglesia.local' });
    await esperarA(() => filas('Horario semanal de misas').length === 2);
    expect(boton('Programar misa')).toBeUndefined();
    expect(boton('Cambiar')).toBeUndefined();
  });

  it('muestra el estado vacío sin misas en el horario', async () => {
    const { harness } = await abrirApp('/', { como: 'admin@iglesia.local' });
    db.horariosMisa = [];
    await harness.navigateByUrl('/misas');
    await esperarA(() => textoPagina().includes('Aún no hay misas en el horario'));
  });
});

describe('padres de la iglesia (E3-15: RF-40, RF-41)', () => {
  it('registra un padre nuevo y queda en la iglesia', async () => {
    await abrirApp('/misas?tab=padres', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Padres de la iglesia').length === 2);
    boton('Agregar padre')!.click();
    await esperarA(() => inputDe('Nombre') !== null);
    escribir(inputDe('Título'), 'Fr.');
    escribir(inputDe('Nombre'), 'Tomás Lara');
    enDialogo('Registrar')!.click();
    await esperarA(() => db.padres.some((p) => p.nombre === 'Tomás Lara'));
    const nuevo = db.padres.find((p) => p.nombre === 'Tomás Lara')!;
    expect(nuevo.titulo).toBe('Fr.');
    expect(db.padresIglesia.some((a) => a.padreId === nuevo.id && a.activo)).toBe(true);
    await esperarA(() => filas('Padres de la iglesia').length === 3);
  });

  it('busca un padre que ya existe en otra iglesia y lo asocia', async () => {
    const { harness } = await abrirApp('/', { como: 'admin@iglesia.local' });
    db.padres.push({ id: 'pa-julian', nombre: 'Julián Mena' });
    await harness.navigateByUrl('/misas?tab=padres');
    await esperarA(() => filas('Padres de la iglesia').length === 2);
    boton('Agregar padre')!.click();
    await esperarA(() => inputDe('Buscar un padre') !== null);
    escribir(inputDe('Buscar un padre'), 'Julián');
    await esperarA(() => enDialogo('Asociar') !== undefined);
    enDialogo('Asociar')!.click();
    await esperarA(() => db.padresIglesia.some((a) => a.padreId === 'pa-julian'));
    await esperarA(() => filas('Padres de la iglesia').length === 3);
  });

  it('no quita a un padre que tiene misas en el horario y lo explica', async () => {
    await abrirApp('/misas?tab=padres', { como: 'admin@iglesia.local' });
    await esperarA(() => filas('Padres de la iglesia').length === 2);
    botones()
      .find((b) => b.getAttribute('aria-label') === 'Quitar a Luis Pérez Cámara de la iglesia')!
      .click();
    await esperarA(() => enDialogo('Quitar') !== undefined);
    enDialogo('Quitar')!.click();
    await esperarA(() => textoPagina().includes('Asígnalas a otro padre antes de quitarlo'));
    expect(db.padresIglesia.find((a) => a.padreId === 'pa-luis')!.activo).toBe(true);
  });
});

describe('misas celebradas (E3-15: RF-48–RF-51)', () => {
  it('registra una misa con sustitución y la lista muestra quién la dio y por qué', async () => {
    await abrirApp('/misas?tab=celebradas', { como: 'admin@iglesia.local' });
    await esperarA(() => boton('Registrar misa') !== undefined);
    boton('Registrar misa')!.click();
    await esperarA(() => campo('Misa del horario') !== undefined);
    await elegir('Misa del horario', 'Domingo 10:00');
    escribir(inputDe('Fecha'), domingoPasado());
    document.querySelector<HTMLInputElement>('mat-dialog-container mat-checkbox input')!.click();
    await esperarA(() => campo('Padre que la dio') !== undefined);
    await elegir('Padre que la dio', 'Ramón Cauich Dzul');
    escribir(inputDe('Motivo'), 'El párroco está enfermo.');
    enDialogo('Registrar')!.click();
    await esperarA(() => Object.keys(db.sustitucionesMisa).length === 1);
    const s = Object.values(db.sustitucionesMisa)[0]!;
    expect(s).toMatchObject({ padreProgramadoId: 'pa-luis', motivo: 'El párroco está enfermo.' });
  });

  it('valida el día del horario y que la sustitución lleve motivo', async () => {
    await abrirApp('/misas?tab=celebradas', { como: 'admin@iglesia.local' });
    await esperarA(() => boton('Registrar misa') !== undefined);
    boton('Registrar misa')!.click();
    await esperarA(() => campo('Misa del horario') !== undefined);
    await elegir('Misa del horario', 'Domingo 10:00');
    const lunes = new Date(new Date(`${domingoPasado()}T12:00:00Z`).getTime() + DIA)
      .toISOString()
      .slice(0, 10);
    escribir(inputDe('Fecha'), lunes);
    document.querySelector<HTMLInputElement>('mat-dialog-container mat-checkbox input')!.click();
    await esperarA(() => campo('Motivo') !== undefined);
    enDialogo('Registrar')!.click();
    await esperarA(() => textoPagina().includes('Esa fecha no es domingo.'));
    expect(textoPagina()).toContain('Escribe el motivo.');
    expect(textoPagina()).toContain('Elige el padre que la dio.');
    expect(Object.keys(db.sustitucionesMisa)).toHaveLength(0);
  });
});

describe('agenda semanal del padre (E3-16: RF-47)', () => {
  it('reúne las misas del padre en todas sus iglesias', async () => {
    await abrirApp('/padres/pa-luis/agenda?semana=2026-11-25', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Agenda de Luis Pérez Cámara'));
    await esperarA(() => textoPagina().includes('Parroquia Comunidad de Fe'));
    expect(textoPagina()).toContain('Capilla del Valle');
    expect(textoPagina()).toContain('Del 22/11/2026 al 28/11/2026');
  });

  it('cambia de semana', async () => {
    await abrirApp('/padres/pa-luis/agenda?semana=2026-11-25', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Del 22/11/2026'));
    boton('Semana siguiente')!.click();
    await esperarA(() => textoPagina().includes('Del 29/11/2026'));
  });

  it('la Coordinación busca padres con sus iglesias y registra uno nuevo', async () => {
    await abrirApp('/padres', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => filas('Padres del país').length === 2);
    const luis = filas('Padres del país').find((f) => f.textContent?.includes('Luis'))!;
    expect(luis.textContent).toContain('Parroquia Comunidad de Fe');
    expect(luis.textContent).toContain('Capilla del Valle');
    escribir(inputDe('Nombre del padre'), 'Rafael Soto');
    boton('Registrar padre')!.click();
    await esperarA(() => db.padres.some((p) => p.nombre === 'Rafael Soto'));
    await esperar(50);
  });

  it('el tesorero no entra a la página de padres del país', async () => {
    const { router } = await abrirApp('/padres', { como: 'tesorero@iglesia.local' });
    await esperarA(() => router.url === '/sin-acceso');
  });
});
