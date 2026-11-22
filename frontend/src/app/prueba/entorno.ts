import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { guardarToken, interceptorApi } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import { interceptorMocks } from '@/mocks/interceptor';
import { reiniciarDb } from '@/mocks/db';
import { PASSWORD_MOCK } from '@/mocks/datos/b1';
import { routes } from '@/app/app.routes';

/**
 * Prepara la app completa (rutas reales + mocks de MSW como interceptor) para una prueba.
 * Equivale a `renderApp` del frontend en React.
 * @example const { harness } = await abrirApp('/miembros', { como: 'admin@iglesia.local' });
 */
export async function abrirApp(url: string, opciones: { como?: string } = {}) {
  reiniciarDb();
  guardarToken(null);
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors([interceptorApi, interceptorMocks])),
      {
        provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
        useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
      },
    ],
  });
  const sesion = TestBed.inject(SesionService);
  if (opciones.como) await sesion.iniciarSesion(opciones.como, PASSWORD_MOCK);
  else await sesion.restaurar();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await esperar();
  return { harness, router: TestBed.inject(Router), sesion };
}

/** Deja correr las peticiones simuladas y vuelve a dibujar. */
export async function esperar(ms = 0) {
  await new Promise((r) => setTimeout(r, ms));
  await TestBed.inject(Router).navigated;
  TestBed.tick();
  await new Promise((r) => setTimeout(r, 0));
  TestBed.tick();
}

/** Espera hasta que `condicion` se cumpla (máx. 3 s), redibujando entre intentos. */
export async function esperarA(condicion: () => boolean, maxMs = 3000) {
  const inicio = Date.now();
  while (!condicion()) {
    if (Date.now() - inicio > maxMs) throw new Error('La condición no se cumplió a tiempo.');
    await esperar(20);
  }
}

/** Texto visible de todo el documento (incluye diálogos y menús en overlays). */
export function textoPagina() {
  return document.body.textContent ?? '';
}

/** Escribe en un input y dispara el evento `input` (lo que escucha Angular). */
export function escribir(elemento: Element | null, valor: string) {
  const input = elemento as HTMLInputElement;
  input.value = valor;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

export type { Type };
