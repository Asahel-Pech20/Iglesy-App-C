import { http, HttpResponse } from 'msw';
import type { Rol } from '@/app/tipos/comunes';
import type { CrearUsuario, Usuario } from '@/app/tipos/usuarios';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

const adminsActivos = () => db.usuarios.filter((u) => u.rol === 'ADMIN_IGLESIA' && u.activo);

function emailDuplicado(email: string, exceptoId?: string) {
  return db.usuarios.some((u) => u.email === email.toLowerCase() && u.id !== exceptoId);
}

const errorEmail = () =>
  errorApi(409, 'CONFLICT', 'El correo ya está registrado.', [
    { campo: 'email', mensaje: 'El correo ya está registrado.' },
  ]);

export const usuariosHandlers = [
  http.get(ruta('/usuarios/opciones'), ({ request }) => {
    const usuario = autenticar(request, 'usuarios:opciones');
    if (usuario instanceof Response) return usuario;
    const rol = new URL(request.url).searchParams.get('rol');
    const data = db.usuarios
      .filter((u) => u.activo && (!rol || u.rol === rol))
      .map(({ id, nombre, rol }) => ({ id, nombre, rol }));
    return HttpResponse.json({ data });
  }),

  http.get(ruta('/usuarios'), ({ request }) => {
    const usuario = autenticar(request, 'usuarios:leer');
    if (usuario instanceof Response) return usuario;
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const rol = url.searchParams.get('rol');
    const activo = url.searchParams.get('activo');
    const lista = db.usuarios
      .filter((u) => !q || u.nombre.toLowerCase().includes(q) || u.email.includes(q))
      .filter((u) => !rol || u.rol === rol)
      .filter((u) => activo === null || String(u.activo) === activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return paginarMock(lista, url);
  }),

  http.get(ruta('/usuarios/:id'), ({ request, params }) => {
    const usuario = autenticar(request, 'usuarios:leer');
    if (usuario instanceof Response) return usuario;
    const encontrado = db.usuarios.find((u) => u.id === params.id);
    if (!encontrado) return errorApi(404, 'NOT_FOUND', 'El usuario no existe.');
    return HttpResponse.json({ data: encontrado });
  }),

  http.post(ruta('/usuarios'), async ({ request }) => {
    const usuario = autenticar(request, 'usuarios:crear');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as CrearUsuario;
    if (emailDuplicado(cuerpo.email)) return errorEmail();
    // Solo la Coordinación indica la iglesia; el administrador crea en la suya
    const iglesiaId =
      cuerpo.rol === 'COORDINACION' ? null : (usuario.iglesiaId ?? cuerpo.iglesiaId ?? null);
    if (cuerpo.rol !== 'COORDINACION' && !iglesiaId) {
      return errorApi(400, 'VALIDATION_ERROR', 'Indica la iglesia del usuario.', [
        { campo: 'iglesiaId', mensaje: 'Elige la iglesia.' },
      ]);
    }
    const nuevo: Usuario = {
      id: crypto.randomUUID(),
      nombre: cuerpo.nombre,
      email: cuerpo.email.toLowerCase(),
      rol: cuerpo.rol,
      iglesiaId,
      activo: true,
      ultimoAcceso: null,
      createdAt: ahora(),
      updatedAt: ahora(),
    };
    db.usuarios.push(nuevo);
    return HttpResponse.json({ data: nuevo }, { status: 201 });
  }),

  http.patch(ruta('/usuarios/:id'), async ({ request, params }) => {
    const usuario = autenticar(request, 'usuarios:editar');
    if (usuario instanceof Response) return usuario;
    const objetivo = db.usuarios.find((u) => u.id === params.id);
    if (!objetivo) return errorApi(404, 'NOT_FOUND', 'El usuario no existe.');
    const cuerpo = (await request.json()) as Partial<CrearUsuario>;
    if (cuerpo.email && emailDuplicado(cuerpo.email, objetivo.id)) return errorEmail();
    const quitaAdmin =
      objetivo.rol === 'ADMIN_IGLESIA' && cuerpo.rol && cuerpo.rol !== 'ADMIN_IGLESIA';
    if (quitaAdmin && adminsActivos().length === 1) {
      return errorApi(422, 'BUSINESS_RULE', 'Debe existir al menos un administrador activo.');
    }
    Object.assign(objetivo, cuerpo, { updatedAt: ahora() });
    return HttpResponse.json({ data: objetivo });
  }),

  http.patch(ruta('/usuarios/:id/estado'), async ({ request, params }) => {
    const usuario = autenticar(request, 'usuarios:eliminar');
    if (usuario instanceof Response) return usuario;
    const objetivo = db.usuarios.find((u) => u.id === params.id);
    if (!objetivo) return errorApi(404, 'NOT_FOUND', 'El usuario no existe.');
    const { activo } = (await request.json()) as { activo: boolean };
    if (!activo && objetivo.id === usuario.id) {
      return errorApi(422, 'BUSINESS_RULE', 'No puedes desactivar tu propia cuenta.');
    }
    if (!activo && objetivo.rol === ('ADMIN_IGLESIA' as Rol) && adminsActivos().length === 1) {
      return errorApi(422, 'BUSINESS_RULE', 'Debe existir al menos un administrador activo.');
    }
    objetivo.activo = activo;
    objetivo.updatedAt = ahora();
    return HttpResponse.json({ data: objetivo });
  }),

  http.post(ruta('/usuarios/:id/reenviar-invitacion'), ({ request, params }) => {
    const usuario = autenticar(request, 'usuarios:editar');
    if (usuario instanceof Response) return usuario;
    if (!db.usuarios.some((u) => u.id === params.id)) {
      return errorApi(404, 'NOT_FOUND', 'El usuario no existe.');
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
