import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TemaService } from './tema.service';

afterEach(() => {
  history.replaceState(null, '', '/');
  document.documentElement.classList.remove('dark');
  localStorage.clear();
  TestBed.resetTestingModule();
});

describe('tema que trae la landing (?tema=)', () => {
  it('?tema=claro gana sobre un oscuro guardado y se guarda', () => {
    localStorage.setItem('appiglesia:tema', 'oscuro');
    history.replaceState(null, '', '/login?tema=claro');
    TestBed.inject(TemaService);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('appiglesia:tema')).toBe('claro');
  });

  it('?tema=oscuro pone el modo noche', () => {
    history.replaceState(null, '', '/templos?estado=21&tema=oscuro');
    TestBed.inject(TemaService);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sin ?tema= (o con un valor raro) respeta lo guardado', () => {
    localStorage.setItem('appiglesia:tema', 'oscuro');
    history.replaceState(null, '', '/login?tema=rosa');
    TestBed.inject(TemaService);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
