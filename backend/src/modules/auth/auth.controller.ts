import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env';
import { ok } from '../../lib/respuesta';
import { duracionMs } from '../../lib/seguridad';
import { usuarioDe } from '../../middlewares/auth';
import * as authService from './auth.service';

export const COOKIE_REFRESH = 'refreshToken';

// AGENTS.md §3: httpOnly; Secure (prod); SameSite=Strict; Path=/api/v1/auth
function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  };
}

function guardarCookie(res: Response, token: string) {
  res.cookie(COOKIE_REFRESH, token, {
    ...opcionesCookie(),
    maxAge: duracionMs(env.JWT_REFRESH_TTL),
  });
}

const cookieDe = (req: Request) => req.cookies?.[COOKIE_REFRESH] as string | undefined;

export const login: RequestHandler = async (req, res) => {
  const { accessToken, refreshToken, sesion } = await authService.login(
    req.body.email,
    req.body.password,
  );
  guardarCookie(res, refreshToken);
  res.json(ok({ accessToken, ...sesion }));
};

export const refrescar: RequestHandler = async (req, res) => {
  try {
    const { accessToken, refreshToken } = await authService.refrescar(cookieDe(req));
    guardarCookie(res, refreshToken);
    res.json(ok({ accessToken }));
  } catch (err) {
    res.clearCookie(COOKIE_REFRESH, opcionesCookie());
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(cookieDe(req));
  res.clearCookie(COOKIE_REFRESH, opcionesCookie());
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  res.json(ok(await authService.obtenerSesion(usuarioDe(req).id)));
};

export const olvide: RequestHandler = async (req, res) => {
  await authService.solicitarRecuperacion(req.body.email);
  res.status(204).end();
};

export const restablecer: RequestHandler = async (req, res) => {
  await authService.restablecer(req.body.token, req.body.password);
  res.status(204).end();
};

export const cambiarPassword: RequestHandler = async (req, res) => {
  await authService.cambiarPassword(
    usuarioDe(req).id,
    req.body.passwordActual,
    req.body.passwordNueva,
  );
  res.status(204).end();
};
