import { http, HttpResponse } from 'msw';
import { PERMISOS_POR_ROL } from '@/app/core/permisos';
import type { Usuario } from '@/app/tipos/usuarios';
import { PASSWORD_MOCK } from '../datos/b1';
import { db, sesionMock } from '../db';
import { ahora, autenticar, errorApi, PREFIJO_TOKEN, ruta } from '../utils';

const sesionDe = (usuario: Usuario) => {
  const iglesia = db.iglesias.find((i) => i.id === usuario.iglesiaId);
  return {
    usuario,
    permisos: PERMISOS_POR_ROL[usuario.rol],
    // Igual que el backend (E1-02): solo id, nombre y estado; null en la Coordinación
    iglesia: iglesia ? { id: iglesia.id, nombre: iglesia.nombre, activa: iglesia.activa } : null,
  };
};

const reglaPassword = (password: string) =>
  password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);

export const authHandlers = [
  http.post(ruta('/auth/login'), async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (email === 'bloqueado@iglesia.local') {
      return errorApi(429, 'RATE_LIMITED', 'Demasiados intentos, espera un minuto.');
    }
    const usuario = db.usuarios.find((u) => u.email === email?.toLowerCase());
    if (!usuario || !usuario.activo || password !== PASSWORD_MOCK) {
      return errorApi(401, 'UNAUTHENTICATED', 'Correo o contraseña incorrectos.');
    }
    usuario.ultimoAcceso = ahora();
    sesionMock.abrir(usuario.id);
    return HttpResponse.json({
      data: { accessToken: `${PREFIJO_TOKEN}${usuario.id}`, ...sesionDe(usuario) },
    });
  }),

  http.post(ruta('/auth/refresh'), () => {
    const id = sesionMock.obtener();
    const usuario = db.usuarios.find((u) => u.id === id && u.activo);
    if (!usuario) return errorApi(401, 'UNAUTHENTICATED', 'Debes iniciar sesión.');
    return HttpResponse.json({ data: { accessToken: `${PREFIJO_TOKEN}${usuario.id}` } });
  }),

  http.post(ruta('/auth/logout'), () => {
    sesionMock.cerrar();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(ruta('/auth/me'), ({ request }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    return HttpResponse.json({ data: sesionDe(usuario) });
  }),

  http.post(ruta('/auth/forgot-password'), () => new HttpResponse(null, { status: 204 })),

  http.post(ruta('/auth/reset-password'), async ({ request }) => {
    const { token, password } = (await request.json()) as { token: string; password: string };
    const usuarioId = db.tokensReset.get(token);
    if (!usuarioId) {
      return errorApi(400, 'VALIDATION_ERROR', 'El enlace no es válido o ya expiró.', [
        { campo: 'token', mensaje: 'El enlace no es válido o ya expiró.' },
      ]);
    }
    if (!reglaPassword(password)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'password', mensaje: 'Mínimo 8 caracteres, con al menos una letra y un número.' },
      ]);
    }
    db.tokensReset.delete(token);
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch(ruta('/auth/me/password'), async ({ request }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    const { passwordActual, passwordNueva } = (await request.json()) as {
      passwordActual: string;
      passwordNueva: string;
    };
    if (passwordActual !== PASSWORD_MOCK) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { campo: 'passwordActual', mensaje: 'La contraseña actual es incorrecta.' },
      ]);
    }
    if (!reglaPassword(passwordNueva)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        {
          campo: 'passwordNueva',
          mensaje: 'Mínimo 8 caracteres, con al menos una letra y un número.',
        },
      ]);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
