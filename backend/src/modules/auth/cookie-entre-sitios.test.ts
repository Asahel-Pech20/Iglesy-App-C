import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { validarEnv } from '../../config/env';
import { opcionesCookie } from './auth.controller';
import { exigirOrigenFrontend } from './auth.routes';

// Render gratis: el frontend y la API viven en dos *.onrender.com, que el navegador trata como sitios
// distintos. Con COOKIE_SAMESITE=none la cookie viaja, va Secure y se exige el Origin del frontend.
const FRONTEND = 'https://iglesy.onrender.com';

const peticion = (origin?: string) => ({ get: () => origin }) as unknown as Request;

function correr(middleware: ReturnType<typeof exigirOrigenFrontend>, origin?: string) {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  middleware(peticion(origin), {} as Response, next);
  return next.mock.calls[0]?.[0] as { status?: number } | undefined;
}

describe('cookie de refresh entre sitios (Render)', () => {
  it('por defecto sigue AGENTS.md §3: SameSite=Strict', () => {
    const base = {
      DATABASE_URL: 'postgresql://x:y@localhost:5432/db',
      JWT_ACCESS_SECRET: 'a',
      JWT_REFRESH_SECRET: 'b',
      FRONTEND_URL: FRONTEND,
    };
    expect(validarEnv(base).COOKIE_SAMESITE).toBe('strict');
    expect(() => validarEnv({ ...base, COOKIE_SAMESITE: 'cualquiera' })).toThrow(/COOKIE_SAMESITE/);
  });

  it('con «none» la cookie va Secure aunque no sea producción', () => {
    expect(opcionesCookie({ NODE_ENV: 'development', COOKIE_SAMESITE: 'none' })).toMatchObject({
      sameSite: 'none',
      secure: true,
      httpOnly: true,
      path: '/api/v1/auth',
    });
    expect(opcionesCookie({ NODE_ENV: 'development', COOKIE_SAMESITE: 'strict' })).toMatchObject({
      sameSite: 'strict',
      secure: false,
    });
  });

  it('con «none» refresh y logout solo aceptan el Origin del frontend', () => {
    const revisar = exigirOrigenFrontend({ COOKIE_SAMESITE: 'none', FRONTEND_URL: FRONTEND });
    expect(correr(revisar, FRONTEND)).toBeUndefined();
    expect(correr(revisar, 'https://otro-sitio.onrender.com')?.status).toBe(403);
    // Sin Origin (un formulario o una herramienta) tampoco
    expect(correr(revisar)?.status).toBe(403);
  });

  it('con «strict» no se revisa el Origin (desarrollo y pruebas igual que antes)', () => {
    const revisar = exigirOrigenFrontend({ COOKIE_SAMESITE: 'strict', FRONTEND_URL: FRONTEND });
    expect(correr(revisar, 'https://otro-sitio.onrender.com')).toBeUndefined();
  });
});
