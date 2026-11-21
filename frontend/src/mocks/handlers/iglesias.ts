import { http, HttpResponse } from 'msw';
import type { DetalleError } from '@/app/tipos/comunes';
import type {
  CerrarIglesia,
  CrearIglesia,
  DatosIglesia,
  Iglesia,
  LugarInegi,
  TipoIglesia,
} from '@/app/tipos/iglesias';
import type { Usuario } from '@/app/tipos/usuarios';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

// Simulación de backend/src/modules/iglesias (base de Oscar, ampliada en E2-06 por Nataly) y del
// catálogo público del INEGI (E2-05).

const TIPOS: TipoIglesia[] = [
  'CATEDRAL',
  'BASILICA',
  'PARROQUIA',
  'TEMPLO',
  'CAPILLA',
  'SANTUARIO',
];

const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

const invalido = (errores: DetalleError[]) =>
  errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', errores);

/** Busca por nombre sin distinguir mayúsculas. */
const conNombre = (q: string | null) => (l: LugarInegi) =>
  !q || l.nombre.toLowerCase().includes(q.toLowerCase());

/** RN-09: la ubicación existe en el catálogo y es consistente. Devuelve los lugares o un error. */
type Ubicacion = Pick<Iglesia, 'estado' | 'municipio' | 'localidad'>;
const esError = (r: DetalleError | Ubicacion): r is DetalleError => 'mensaje' in r;

function resolverUbicacion(u: {
  estado: string | null;
  municipio: string | null;
  localidad: string | null;
}): DetalleError | Ubicacion {
  const estado = u.estado ? db.estadosInegi.find((e) => e.clave === u.estado) : null;
  const municipio = u.municipio ? db.municipiosInegi.find((m) => m.clave === u.municipio) : null;
  const localidad = u.localidad ? db.localidadesInegi.find((l) => l.clave === u.localidad) : null;
  if (u.estado && !estado)
    return { campo: 'estado', mensaje: 'El estado no existe en el catálogo.' };
  if (u.municipio && (!u.estado || municipio?.estado !== u.estado))
    return { campo: 'municipio', mensaje: 'El municipio no pertenece al estado elegido.' };
  if (u.localidad && (!u.municipio || localidad?.municipio !== u.municipio))
    return { campo: 'localidad', mensaje: 'La localidad no pertenece al municipio elegido.' };
  const lugar = (l: LugarInegi | null | undefined) =>
    l ? { clave: l.clave, nombre: l.nombre } : null;
  return { estado: lugar(estado), municipio: lugar(municipio), localidad: lugar(localidad) };
}

/** Valida y normaliza los datos de la ficha (los mismos campos que el backend). */
function datosDeFicha(cuerpo: DatosIglesia, actual?: Iglesia) {
  const errores: DetalleError[] = [];
  const latitud = cuerpo.latitud !== undefined ? cuerpo.latitud : (actual?.latitud ?? null);
  const longitud = cuerpo.longitud !== undefined ? cuerpo.longitud : (actual?.longitud ?? null);
  if ((latitud === null) !== (longitud === null))
    errores.push({
      campo: latitud === null ? 'latitud' : 'longitud',
      mensaje: 'Escribe latitud y longitud juntas.',
    });
  if (cuerpo.capacidad !== undefined && cuerpo.capacidad !== null && cuerpo.capacidad <= 0)
    errores.push({ campo: 'capacidad', mensaje: 'La capacidad debe ser mayor que 0.' });
  if (cuerpo.correo && !/^\S+@\S+\.\S+$/.test(cuerpo.correo))
    errores.push({ campo: 'correo', mensaje: 'Correo no válido.' });
  return errores;
}

function alcance(usuario: Usuario, iglesiaId: string) {
  return usuario.iglesiaId === null || usuario.iglesiaId === iglesiaId;
}

export const iglesiasHandlers = [
  // ───────── Catálogo del INEGI (público, paginado y con ?q=) ─────────
  http.get(ruta('/public/estados'), ({ request }) => {
    const url = new URL(request.url);
    return paginarMock(db.estadosInegi.filter(conNombre(url.searchParams.get('q'))), url);
  }),

  http.get(ruta('/public/estados/:clave/municipios'), ({ request, params }) => {
    const url = new URL(request.url);
    if (!db.estadosInegi.some((e) => e.clave === params['clave']))
      return errorApi(404, 'NOT_FOUND', 'El estado no existe en el catálogo.');
    const lista = db.municipiosInegi
      .filter((m) => m.estado === params['clave'])
      .filter(conNombre(url.searchParams.get('q')))
      .map(({ clave, nombre }) => ({ clave, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return paginarMock(lista, url);
  }),

  http.get(ruta('/public/municipios/:clave/localidades'), ({ request, params }) => {
    const url = new URL(request.url);
    if (!db.municipiosInegi.some((m) => m.clave === params['clave']))
      return errorApi(404, 'NOT_FOUND', 'El municipio no existe en el catálogo.');
    const lista = db.localidadesInegi
      .filter((l) => l.municipio === params['clave'])
      .filter(conNombre(url.searchParams.get('q')))
      .map(({ clave, nombre }) => ({ clave, nombre }));
    return paginarMock(lista, url);
  }),

  // ───────── Iglesias (panel) ─────────
  http.get(ruta('/iglesias'), ({ request }) => {
    const usuario = autenticar(request, 'iglesias:leer');
    if (usuario instanceof Response) return usuario;
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const estado = url.searchParams.get('estado');
    const situacion = url.searchParams.get('situacion') ?? 'todas';
    const lista = db.iglesias
      .filter((i) => !q || i.nombre.toLowerCase().includes(q))
      .filter((i) => !estado || i.estado?.clave === estado)
      .filter((i) => situacion === 'todas' || i.activa === (situacion === 'activas'))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return paginarMock(lista, url);
  }),

  http.get(ruta('/iglesias/:id'), ({ request, params }) => {
    const usuario = autenticar(request);
    if (usuario instanceof Response) return usuario;
    const iglesia = db.iglesias.find((i) => i.id === params['id']);
    if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    if (!alcance(usuario, iglesia.id)) return errorApi(403, 'FORBIDDEN', 'No tienes permiso.');
    return HttpResponse.json({ data: iglesia });
  }),

  http.post(ruta('/iglesias'), async ({ request }) => {
    const usuario = autenticar(request, 'iglesias:crear');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as Partial<CrearIglesia>;
    const nombre = cuerpo.nombre?.trim() ?? '';
    const zonaHoraria = cuerpo.zonaHoraria?.trim() || 'America/Mexico_City';
    const errores: DetalleError[] = datosDeFicha(cuerpo);
    if (!nombre) errores.push({ campo: 'nombre', mensaje: 'Escribe el nombre.' });
    if (!cuerpo.tipo || !TIPOS.includes(cuerpo.tipo)) {
      errores.push({ campo: 'tipo', mensaje: 'Elige un tipo de iglesia válido.' });
    }
    if (!zonaValida(zonaHoraria)) {
      errores.push({
        campo: 'zonaHoraria',
        mensaje: 'Zona horaria no válida (ej. America/Mexico_City).',
      });
    }
    if (errores.length > 0) return invalido(errores);
    if (db.iglesias.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      return errorApi(409, 'CONFLICT', 'Ya existe una iglesia con ese nombre.');
    }
    const ubicacion = resolverUbicacion({
      estado: cuerpo.estado ?? null,
      municipio: cuerpo.municipio ?? null,
      localidad: cuerpo.localidad ?? null,
    });
    if (esError(ubicacion)) return invalido([ubicacion]);
    const iglesia: Iglesia = {
      id: crypto.randomUUID(),
      nombre,
      tipo: cuerpo.tipo as TipoIglesia,
      zonaHoraria,
      activa: true,
      direccion: cuerpo.direccion ?? null,
      capacidad: cuerpo.capacidad ?? null,
      anioConstruccion: cuerpo.anioConstruccion ?? null,
      telefono: cuerpo.telefono ?? null,
      correo: cuerpo.correo ?? null,
      latitud: cuerpo.latitud?.toFixed(6) ?? null,
      longitud: cuerpo.longitud?.toFixed(6) ?? null,
      fechaCierre: null,
      motivoCierre: null,
      ...ubicacion,
      createdAt: ahora(),
      updatedAt: ahora(),
    };
    db.iglesias.push(iglesia);
    return HttpResponse.json({ data: iglesia }, { status: 201 });
  }),

  http.patch(ruta('/iglesias/:id'), async ({ request, params }) => {
    const usuario = autenticar(request, 'iglesias:editar');
    if (usuario instanceof Response) return usuario;
    const iglesia = db.iglesias.find((i) => i.id === params['id']);
    if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    if (!alcance(usuario, iglesia.id)) return errorApi(403, 'FORBIDDEN', 'No tienes permiso.');
    if (!iglesia.activa)
      return errorApi(422, 'BUSINESS_RULE', 'La iglesia está cerrada; no se puede editar.');
    const cuerpo = (await request.json()) as Partial<CrearIglesia>;
    const errores = datosDeFicha(cuerpo, iglesia);
    if (cuerpo.nombre !== undefined && !cuerpo.nombre.trim())
      errores.push({ campo: 'nombre', mensaje: 'Escribe el nombre.' });
    if (errores.length > 0) return invalido(errores);
    // Como el backend (A2-E2-03): solo un cambio real de estado borra municipio y localidad
    const cambiaEstado =
      cuerpo.estado !== undefined && cuerpo.estado !== (iglesia.estado?.clave ?? null);
    const municipio =
      cuerpo.municipio !== undefined
        ? cuerpo.municipio
        : cambiaEstado
          ? null
          : (iglesia.municipio?.clave ?? null);
    const cambiaMunicipio = municipio !== (iglesia.municipio?.clave ?? null);
    const ubicacion = resolverUbicacion({
      estado: cuerpo.estado !== undefined ? cuerpo.estado : (iglesia.estado?.clave ?? null),
      municipio,
      localidad:
        cuerpo.localidad !== undefined
          ? cuerpo.localidad
          : cambiaMunicipio
            ? null
            : (iglesia.localidad?.clave ?? null),
    });
    if (esError(ubicacion)) return invalido([ubicacion]);
    const { estado: _e, municipio: _m, localidad: _l, latitud, longitud, ...resto } = cuerpo;
    Object.assign(iglesia, resto, ubicacion, {
      ...(latitud !== undefined && { latitud: latitud === null ? null : latitud.toFixed(6) }),
      ...(longitud !== undefined && { longitud: longitud === null ? null : longitud.toFixed(6) }),
      updatedAt: ahora(),
    });
    return HttpResponse.json({ data: iglesia });
  }),

  http.post(ruta('/iglesias/:id/cierre'), async ({ request, params }) => {
    const usuario = autenticar(request, 'iglesias:cerrar');
    if (usuario instanceof Response) return usuario;
    const iglesia = db.iglesias.find((i) => i.id === params['id']);
    if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    if (!iglesia.activa) return errorApi(422, 'BUSINESS_RULE', 'La iglesia ya está cerrada.');
    const cuerpo = (await request.json()) as Partial<CerrarIglesia>;
    const errores: DetalleError[] = [];
    if (!cuerpo.fecha)
      errores.push({ campo: 'fecha', mensaje: 'Fecha no válida (formato yyyy-MM-dd).' });
    else if (cuerpo.fecha > new Date().toISOString().slice(0, 10))
      errores.push({ campo: 'fecha', mensaje: 'La fecha de cierre no puede ser futura.' });
    if ((cuerpo.motivo?.trim().length ?? 0) < 3)
      errores.push({ campo: 'motivo', mensaje: 'Escribe el motivo del cierre.' });
    if (errores.length > 0) return invalido(errores);
    Object.assign(iglesia, {
      activa: false,
      fechaCierre: cuerpo.fecha,
      motivoCierre: cuerpo.motivo?.trim(),
      updatedAt: ahora(),
    });
    return HttpResponse.json({ data: iglesia });
  }),
];
