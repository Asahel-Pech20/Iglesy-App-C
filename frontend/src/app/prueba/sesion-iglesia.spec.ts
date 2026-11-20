// E1-02: la barra superior muestra la iglesia del usuario (la trae la sesión, no otra llamada).
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SesionService } from '@/app/core/sesion.service';
import { abrirApp, esperarA } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const barra = () => document.querySelector('header.barra')?.textContent ?? '';

describe('iglesia en la sesión (E1-02)', () => {
  it('el personal ve su rol y su iglesia en la barra superior', async () => {
    await abrirApp('/', { como: 'pastor@iglesia.local' });
    await esperarA(() => barra().includes('Parroquia Comunidad de Fe'));
    expect(barra()).toContain('Pastor');
    expect(TestBed.inject(SesionService).iglesia()).toEqual({
      id: 'ig-comunidad',
      nombre: 'Parroquia Comunidad de Fe',
      activa: true,
    });
  });

  it('la Coordinación no tiene iglesia: solo su rol nacional', async () => {
    await abrirApp('/', { como: 'coordinacion@iglesia.local' });
    await esperarA(() => barra().includes('Coordinación Nacional'));
    expect(TestBed.inject(SesionService).iglesia()).toBeNull();
    expect(barra()).not.toContain('Parroquia Comunidad de Fe');
  });
});
