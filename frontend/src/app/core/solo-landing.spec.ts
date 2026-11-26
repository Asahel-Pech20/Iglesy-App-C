import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { soloLanding } from './solo-landing';

@Component({ template: '' })
class Vacia {}

function crear(urlAplicacion: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Vacia },
        { path: '**', component: Vacia },
      ]),
    ],
  });
  const router = TestBed.inject(Router);
  const abrir = vi.fn();
  soloLanding(router, urlAplicacion, abrir);
  return { router, abrir };
}

describe('build «landing» (sitio principal de Render)', () => {
  it('la landing se queda; lo demás abre la aplicación en su sitio, con la misma ruta', async () => {
    const { router, abrir } = crear('https://demo-iglesy.onrender.com/');
    await router.navigateByUrl('/');
    expect(abrir).not.toHaveBeenCalled();
    await router.navigateByUrl('/templos?estado=21');
    expect(abrir).toHaveBeenCalledWith('https://demo-iglesy.onrender.com/templos?estado=21');
    await router.navigateByUrl('/login');
    expect(abrir).toHaveBeenLastCalledWith('https://demo-iglesy.onrender.com/login');
    // La navegación interna no se queda en otra pantalla de este sitio
    await vi.waitFor(() => expect(router.url).toBe('/'));
  });

  it('sin URL de la aplicación (desarrollo, demo) no cambia nada', async () => {
    const { router, abrir } = crear('');
    await router.navigateByUrl('/templos');
    expect(abrir).not.toHaveBeenCalled();
    expect(router.url).toBe('/templos');
  });
});
