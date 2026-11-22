import { http, HttpResponse } from 'msw';
import { tienePermiso } from '@/app/core/permisos';
import type { Usuario } from '@/app/tipos/usuarios';
import type { CrearMinisterio, Ministerio } from '@/app/tipos/ministerios';
import type { MinisterioMock } from '../datos/b2';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';
import { coincide, normalizar } from './miembros';

function formatear(m: MinisterioMock): Ministerio {
  return {
    ...m,
    totalIntegrantes: db.vinculos.filter((v) => v.ministerioId === m.id && v.activo).length,
    coordinadores: db.coordinaciones
      .filter((c) => c.ministerioId === m.id)
      .map((c) => db.usuarios.find((u) => u.id === c.usuarioId)!)
      .map(({ id, nombre }) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

const noExiste = () => errorApi(404, 'NOT_FOUND', 'El ministerio no existe.');
const NOMBRE_DUPLICADO = 'Ya existe un ministerio con ese nombre.';

function nombreOcupado(nombre: string, exceptoId?: string) {
  return db.ministerios.some(
    (m) => m.nombre.toLowerCase() === nombre.trim().toLowerCase() && m.id !== exceptoId,
  );
}

const errorNombre = () =>
  errorApi(409, 'CONFLICT', NOMBRE_DUPLICADO, [{ campo: 'nombre', mensaje: NOMBRE_DUPLICADO }]);

/** ADMIN_IGLESIA/PASTOR, o COORDINADOR de ese ministerio; si no, 403 */
function puedeGestionar(usuario: Usuario, ministerioId: string) {
  if (tienePermiso(usuario.rol, 'ministerios:editar')) return true;
  return (
    tienePermiso(usuario.rol, 'ministerios:editar-propio') &&
    db.coordinaciones.some((c) => c.ministerioId === ministerioId && c.usuarioId === usuario.id)
  );
}

const prohibido = () =>
  errorApi(
    403,
    'FORBIDDEN',
    'Solo puedes gestionar los integrantes de los ministerios que coordinas.',
  );

export const ministeriosHandlers = [
  http.get(ruta('/ministerios'), ({ request }) => {
    const usuario = autenticar(request, 'ministerios:leer');
    if (usuario instanceof Response) return usuario;
    const url = new URL(request.url);
    const q = normalizar(url.searchParams.get('q') ?? '');
    const activo = url.searchParams.get('activo');
    const lista = db.ministerios
      .filter((m) => !q || normalizar(m.nombre).includes(q))
      .filter((m) => activo === null || String(m.activo) === activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(formatear);
    return paginarMock(lista, url);
  }),

  http.get(ruta('/ministerios/:id'), ({ request, params }) => {
    const usuario = autenticar(request, 'ministerios:leer');
    if (usuario instanceof Response) return usuario;
    const ministerio = db.ministerios.find((m) => m.id === params.id);
    if (!ministerio) return noExiste();
    return HttpResponse.json({ data: formatear(ministerio) });
  }),

  http.post(ruta('/ministerios'), async ({ request }) => {
    const usuario = autenticar(request, 'ministerios:crear');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as CrearMinisterio;
    if (nombreOcupado(cuerpo.nombre)) return errorNombre();
    const nuevo: MinisterioMock = {
      id: crypto.randomUUID(),
      nombre: cuerpo.nombre.trim(),
      descripcion: cuerpo.descripcion || null,
      activo: true,
      createdAt: ahora(),
      updatedAt: ahora(),
    };
    db.ministerios.push(nuevo);
    return HttpResponse.json({ data: formatear(nuevo) }, { status: 201 });
  }),

  http.patch(ruta('/ministerios/:id'), async ({ request, params }) => {
    const usuario = autenticar(request, 'ministerios:editar');
    if (usuario instanceof Response) return usuario;
    const ministerio = db.ministerios.find((m) => m.id === params.id);
    if (!ministerio) return noExiste();
    const cuerpo = (await request.json()) as Partial<CrearMinisterio>;
    if (cuerpo.nombre && nombreOcupado(cuerpo.nombre, ministerio.id)) return errorNombre();
    Object.assign(ministerio, {
      ...(cuerpo.nombre && { nombre: cuerpo.nombre.trim() }),
      ...('descripcion' in cuerpo && { descripcion: cuerpo.descripcion || null }),
      updatedAt: ahora(),
    });
    return HttpResponse.json({ data: formatear(ministerio) });
  }),

  http.patch(ruta('/ministerios/:id/estado'), async ({ request, params }) => {
    const usuario = autenticar(request, 'ministerios:eliminar');
    if (usuario instanceof Response) return usuario;
    const ministerio = db.ministerios.find((m) => m.id === params.id);
    if (!ministerio) return noExiste();
    const { activo } = (await request.json()) as { activo: boolean };
    Object.assign(ministerio, { activo, updatedAt: ahora() });
    return HttpResponse.json({ data: formatear(ministerio) });
  }),

  http.put(ruta('/ministerios/:id/coordinadores'), async ({ request, params }) => {
    const usuario = autenticar(request, 'ministerios:editar');
    if (usuario instanceof Response) return usuario;
    const ministerio = db.ministerios.find((m) => m.id === params.id);
    if (!ministerio) return noExiste();
    const ids = [...new Set(((await request.json()) as { usuarioIds: string[] }).usuarioIds)];
    const invalidos = ids
      .map((id) => db.usuarios.find((u) => u.id === id))
      .filter((u) => !u || !u.activo || !['COORDINADOR', 'PASTOR'].includes(u.rol));
    if (invalidos.length > 0) {
      return errorApi(
        422,
        'BUSINESS_RULE',
        `No se pueden asignar como coordinadores: ${invalidos.map((u) => u?.nombre ?? 'desconocido').join(', ')}.`,
      );
    }
    db.coordinaciones = [
      ...db.coordinaciones.filter((c) => c.ministerioId !== ministerio.id),
      ...ids.map((usuarioId) => ({ ministerioId: ministerio.id, usuarioId })),
    ];
    return HttpResponse.json({ data: formatear(ministerio) });
  }),

  http.get(ruta('/ministerios/:id/miembros'), ({ request, params }) => {
    const usuario = autenticar(request, 'ministerios:leer');
    if (usuario instanceof Response) return usuario;
    if (!db.ministerios.some((m) => m.id === params.id)) return noExiste();
    const url = new URL(request.url);
    const historicos = url.searchParams.get('incluirHistoricos') === 'true';
    const q = url.searchParams.get('q');
    const lista = db.vinculos
      .filter((v) => v.ministerioId === params.id && (historicos || v.activo))
      .map((v) => {
        const m = db.miembros.find((x) => x.id === v.miembroId)!;
        return {
          id: m.id,
          nombre: m.nombre,
          apellidos: m.apellidos,
          telefono: m.telefono,
          email: m.email,
          miembroActivo: m.activo,
          activo: v.activo,
          fechaUnion: v.fechaUnion,
          fechaSalida: v.fechaSalida,
        };
      })
      .filter((i) => coincide(i, q))
      .sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          a.apellidos.localeCompare(b.apellidos) ||
          a.nombre.localeCompare(b.nombre),
      );
    return paginarMock(lista, url);
  }),

  http.post(ruta('/ministerios/:id/miembros'), async ({ request, params }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    const ministerio = db.ministerios.find((m) => m.id === params.id);
    if (!ministerio) return noExiste();
    if (!puedeGestionar(usuario, ministerio.id)) return prohibido();
    if (!ministerio.activo) {
      return errorApi(
        422,
        'BUSINESS_RULE',
        'No se pueden agregar integrantes a un ministerio inactivo.',
      );
    }
    const ids = [...new Set(((await request.json()) as { miembroIds: string[] }).miembroIds)];
    const inactivos = db.miembros.filter((m) => ids.includes(m.id) && !m.activo);
    if (inactivos.length > 0) {
      return errorApi(
        422,
        'BUSINESS_RULE',
        `Los miembros inactivos no se pueden vincular: ${inactivos.map((m) => `${m.nombre} ${m.apellidos}`).join(', ')}.`,
      );
    }
    for (const miembroId of ids) {
      const previo = db.vinculos.find(
        (v) => v.miembroId === miembroId && v.ministerioId === ministerio.id,
      );
      if (previo?.activo) continue;
      if (previo) Object.assign(previo, { activo: true, fechaUnion: ahora(), fechaSalida: null });
      else {
        db.vinculos.push({
          miembroId,
          ministerioId: ministerio.id,
          fechaUnion: ahora(),
          fechaSalida: null,
          activo: true,
        });
      }
    }
    return HttpResponse.json({ data: formatear(ministerio) });
  }),

  http.delete(ruta('/ministerios/:id/miembros/:miembroId'), ({ request, params }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    if (!db.ministerios.some((m) => m.id === params.id)) return noExiste();
    if (!puedeGestionar(usuario, String(params.id))) return prohibido();
    const vinculo = db.vinculos.find(
      (v) => v.ministerioId === params.id && v.miembroId === params.miembroId && v.activo,
    );
    if (!vinculo) return errorApi(404, 'NOT_FOUND', 'El miembro no pertenece a este ministerio.');
    Object.assign(vinculo, { activo: false, fechaSalida: ahora() });
    return new HttpResponse(null, { status: 204 });
  }),
];
