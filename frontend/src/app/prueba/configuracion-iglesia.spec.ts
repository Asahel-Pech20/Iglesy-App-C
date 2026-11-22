// E1-06b: la configuración es la de la iglesia del usuario; nombre y contacto vienen de la ficha.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfiguracionService } from '@/app/features/configuracion/configuracion.service';
import { db } from '@/mocks/db';
import { IGLESIA_MOCK } from '@/mocks/datos/b1';
import { abrirApp, esperar, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('configuración por iglesia (E1-06b)', () => {
  it('nombre, dirección y contacto se muestran en solo lectura con enlace a la ficha', async () => {
    await abrirApp('/configuracion', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Datos de la ficha'));
    expect(textoPagina()).toContain(db.configuracion.nombre);
    expect(textoPagina()).toContain('Se editan en la ficha de la iglesia.');
    const enlace = document.querySelector<HTMLAnchorElement>('a[href^="/templos/"]');
    expect(enlace?.getAttribute('href')).toBe(`/templos/${IGLESIA_MOCK}`);
    // Ya no hay campos de texto para el nombre ni el contacto: solo el sitio web
    const etiquetas = [...document.querySelectorAll('mat-label')].map((l) => l.textContent);
    expect(etiquetas).not.toContain('Nombre de la iglesia');
    expect(etiquetas).toContain('Sitio web');
  });

  it('guardar envía solo lo institucional (el backend rechaza el resto con 400)', async () => {
    await abrirApp('/configuracion', { como: 'admin@iglesia.local' });
    await esperarA(() => !!document.querySelector('input[formcontrolname="sitioWeb"]'));
    const sitio = document.querySelector<HTMLInputElement>('input[formcontrolname="sitioWeb"]')!;
    sitio.value = 'https://parroquia.mx';
    sitio.dispatchEvent(new Event('input'));
    await esperar();
    document.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    await esperarA(() => db.configuracion.sitioWeb === 'https://parroquia.mx');
    expect(TestBed.inject(ConfiguracionService).actual()?.sitioWeb).toBe('https://parroquia.mx');
  });

  it('la Coordinación no pide configuración (no tiene iglesia) y su marca es la nacional', async () => {
    await abrirApp('/', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => textoPagina().includes('Coordinación Nacional'));
    expect(TestBed.inject(ConfiguracionService).actual()).toBeNull();
  });
});
