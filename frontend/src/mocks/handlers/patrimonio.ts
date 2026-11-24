import { http, HttpResponse } from 'msw';
import type { DetalleError } from '@/app/tipos/comunes';
import type { Iglesia } from '@/app/tipos/iglesias';
import type {
  CambiarEstadoObjeto,
  CrearObjeto,
  CriteriosIndice,
  EstadoObjeto,
  ObjetoPatrimonial,
  TipoObjeto,
  VersionCriterios,
} from '@/app/tipos/patrimonio';
import type { Usuario } from '@/app/tipos/usuarios';
import type { ObjetoMock } from '../datos/patrimonio';
import {
  CRITERIOS_INICIALES,
  GRUPO_DE_TIPO,
  anioCalculo,
  anioEfectivo,
  epoca,
  indiceDe,
  puntosObjeto,
} from '../datos/indice';
import { aFechaApi } from '@/app/core/formato';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

// Simulación de backend/src/modules/patrimonio y consultas (E2-08, E2-10–E2-13, Nataly).

const TIPOS = Object.keys(GRUPO_DE_TIPO) as TipoObjeto[];
const TRANSICIONES: Record<EstadoObjeto, EstadoObjeto[]> = {
  VIGENTE: ['PERDIDO', 'PRESTADO', 'BAJA'],
  PRESTADO: ['VIGENTE', 'BAJA'],
  PERDIDO: ['VIGENTE', 'BAJA'],
  BAJA: [],
};

const invalido = (errores: DetalleError[]) =>
  errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', errores);

/** Criterios vigentes: la última versión guardada o los del caso. */
export function criteriosVigentes(): CriteriosIndice {
  const ultima = db.criterios[0];
  if (!ultima) return CRITERIOS_INICIALES;
  const { id: _i, vigenteDesde: _v, creadoPor: _c, ...criterios } = ultima;
  return criterios;
}

export function indiceDeIglesia(iglesiaId: string) {
  const objetos = db.objetos.filter((o) => o.iglesiaId === iglesiaId);
  return {
    ...indiceDe(objetos, criteriosVigentes()),
    anioCalculo: anioCalculo(),
    objetosRegistrados: objetos.length,
    objetosVigentes: objetos.filter((o) => o.estado === 'VIGENTE').length,
  };
}

function formatear(o: ObjetoMock): ObjetoPatrimonial {
  const { iglesiaId: _i, ...resto } = o;
  return {
    ...resto,
    grupo: GRUPO_DE_TIPO[o.tipo],
    epoca: epoca(o),
    antiguedad: anioCalculo() - anioEfectivo(o),
    puntos: puntosObjeto(o, criteriosVigentes()),
  };
}

/** Alcance por iglesia: el personal solo la suya; la Coordinación lee. Cerrada → solo lectura. */
function iglesiaConAlcance(usuario: Usuario, id: string, escribe: boolean): Iglesia | Response {
  const iglesia = db.iglesias.find((i) => i.id === id);
  if (!iglesia) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
  if (usuario.iglesiaId !== null && usuario.iglesiaId !== id)
    return errorApi(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');
  if (escribe && !iglesia.activa)
    return errorApi(
      422,
      'BUSINESS_RULE',
      'La iglesia está cerrada: solo se puede consultar su historia.',
    );
  return iglesia;
}

function validarObjeto(c: Partial<CrearObjeto>, parcial = false): DetalleError[] {
  const errores: DetalleError[] = [];
  const texto = (campo: keyof CrearObjeto, mensaje: string) => {
    const v = c[campo];
    if ((!parcial || v !== undefined) && (typeof v !== 'string' || !v.trim()))
      errores.push({ campo, mensaje });
  };
  texto('descripcion', 'Escribe qué es el objeto.');
  texto('material', 'Escribe el material.');
  texto('estadoConservacion', 'Escribe el estado de conservación.');
  texto('ubicacionEnTemplo', 'Escribe dónde está en el templo.');
  if ((!parcial || c.tipo !== undefined) && !TIPOS.includes(c.tipo as TipoObjeto))
    errores.push({ campo: 'tipo', mensaje: 'Elige un tipo de objeto válido.' });
  if (c.anio !== undefined && c.anio !== null && c.anio > anioCalculo())
    errores.push({ campo: 'anio', mensaje: 'El año no puede ser futuro.' });
  if (c.anio && c.siglo && Math.ceil(c.anio / 100) !== c.siglo)
    errores.push({ campo: 'siglo', mensaje: 'El año no es de ese siglo.' });
  return errores;
}

export const patrimonioHandlers = [
  // ───────── Objetos (panel) ─────────
  http.get(ruta('/iglesias/:id/objetos'), ({ request, params }) => {
    const usuario = autenticar(request, 'patrimonio:leer');
    if (usuario instanceof Response) return usuario;
    const iglesia = iglesiaConAlcance(usuario, params['id'] as string, false);
    if (iglesia instanceof Response) return iglesia;
    const url = new URL(request.url);
    const estado = url.searchParams.get('estado');
    const tipo = url.searchParams.get('tipo');
    const lista = db.objetos
      .filter((o) => o.iglesiaId === iglesia.id)
      .filter((o) => !estado || o.estado === estado)
      .filter((o) => !tipo || o.tipo === tipo)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
      .map(formatear);
    return paginarMock(lista, url);
  }),

  http.get(ruta('/iglesias/:id/indice'), ({ request, params }) => {
    const usuario = autenticar(request, 'patrimonio:leer');
    if (usuario instanceof Response) return usuario;
    const iglesia = iglesiaConAlcance(usuario, params['id'] as string, false);
    if (iglesia instanceof Response) return iglesia;
    return HttpResponse.json({ data: indiceDeIglesia(iglesia.id) });
  }),

  http.post(ruta('/iglesias/:id/objetos'), async ({ request, params }) => {
    const usuario = autenticar(request, 'patrimonio:gestionar');
    if (usuario instanceof Response) return usuario;
    const iglesia = iglesiaConAlcance(usuario, params['id'] as string, true);
    if (iglesia instanceof Response) return iglesia;
    const c = (await request.json()) as Partial<CrearObjeto>;
    const errores = validarObjeto(c);
    if (!c.anio && !c.siglo)
      errores.push({ campo: 'anio', mensaje: 'Escribe el año o, si no se conoce, el siglo.' });
    if (errores.length) return invalido(errores);
    const objeto: ObjetoMock = {
      id: crypto.randomUUID(),
      iglesiaId: iglesia.id,
      descripcion: (c.descripcion as string).trim(),
      tipo: c.tipo as TipoObjeto,
      anio: c.anio ?? null,
      siglo: c.siglo ?? null,
      material: (c.material as string).trim(),
      estadoConservacion: (c.estadoConservacion as string).trim(),
      ubicacionEnTemplo: (c.ubicacionEnTemplo as string).trim(),
      catalogadoInah: Boolean(c.catalogadoInah),
      estado: 'VIGENTE',
      fechaEstado: null,
      motivoEstado: null,
      createdAt: ahora(),
      updatedAt: ahora(),
    };
    db.objetos.push(objeto);
    return HttpResponse.json({ data: formatear(objeto) }, { status: 201 });
  }),

  http.patch(ruta('/iglesias/:id/objetos/:objetoId'), async ({ request, params }) => {
    const usuario = autenticar(request, 'patrimonio:gestionar');
    if (usuario instanceof Response) return usuario;
    const iglesia = iglesiaConAlcance(usuario, params['id'] as string, true);
    if (iglesia instanceof Response) return iglesia;
    const objeto = db.objetos.find(
      (o) => o.id === params['objetoId'] && o.iglesiaId === iglesia.id,
    );
    if (!objeto) return errorApi(404, 'NOT_FOUND', 'El objeto no existe.');
    if (objeto.estado === 'BAJA')
      return errorApi(422, 'BUSINESS_RULE', 'El objeto está dado de baja; ya no se edita.');
    const c = (await request.json()) as Partial<CrearObjeto>;
    const errores = validarObjeto(c, true);
    const anio = c.anio !== undefined ? c.anio : objeto.anio;
    const siglo = c.siglo !== undefined ? c.siglo : objeto.siglo;
    if (anio === null && siglo === null)
      errores.push({ campo: 'anio', mensaje: 'Escribe el año o, si no se conoce, el siglo.' });
    if (errores.length) return invalido(errores);
    Object.assign(objeto, c, { updatedAt: ahora() });
    return HttpResponse.json({ data: formatear(objeto) });
  }),

  http.post(ruta('/iglesias/:id/objetos/:objetoId/estado'), async ({ request, params }) => {
    const usuario = autenticar(request, 'patrimonio:gestionar');
    if (usuario instanceof Response) return usuario;
    const iglesia = iglesiaConAlcance(usuario, params['id'] as string, true);
    if (iglesia instanceof Response) return iglesia;
    const objeto = db.objetos.find(
      (o) => o.id === params['objetoId'] && o.iglesiaId === iglesia.id,
    );
    if (!objeto) return errorApi(404, 'NOT_FOUND', 'El objeto no existe.');
    const c = (await request.json()) as Partial<CambiarEstadoObjeto>;
    const errores: DetalleError[] = [];
    if (!c.fecha)
      errores.push({ campo: 'fecha', mensaje: 'Fecha no válida (formato yyyy-MM-dd).' });
    else if (c.fecha > aFechaApi(new Date()))
      errores.push({ campo: 'fecha', mensaje: 'La fecha no puede ser futura.' });
    if ((c.motivo?.trim().length ?? 0) < 3)
      errores.push({ campo: 'motivo', mensaje: 'Escribe el motivo.' });
    if (errores.length) return invalido(errores);
    if (!c.estado || !TRANSICIONES[objeto.estado].includes(c.estado))
      return errorApi(422, 'BUSINESS_RULE', 'Ese cambio de estado no está permitido.');
    Object.assign(objeto, {
      estado: c.estado,
      fechaEstado: c.fecha,
      motivoEstado: c.motivo?.trim(),
      updatedAt: ahora(),
    });
    return HttpResponse.json({ data: formatear(objeto) });
  }),

  // ───────── Criterios del índice (Coordinación) ─────────
  http.get(ruta('/criterios-indice'), ({ request }) => {
    const usuario = autenticar(request, 'criterios:leer');
    if (usuario instanceof Response) return usuario;
    const vigente: VersionCriterios = db.criterios[0] ?? {
      ...CRITERIOS_INICIALES,
      id: null,
      vigenteDesde: null,
      creadoPor: null,
    };
    return HttpResponse.json({ data: vigente });
  }),

  http.get(ruta('/criterios-indice/historial'), ({ request }) => {
    const usuario = autenticar(request, 'criterios:leer');
    if (usuario instanceof Response) return usuario;
    return paginarMock(db.criterios, new URL(request.url));
  }),

  http.put(ruta('/criterios-indice'), async ({ request }) => {
    const usuario = autenticar(request, 'criterios:editar');
    if (usuario instanceof Response) return usuario;
    const c = (await request.json()) as CriteriosIndice;
    const errores: DetalleError[] = [];
    if (c.rangosEdad[0]?.desdeAnios !== 0)
      errores.push({ campo: 'rangosEdad', mensaje: 'El primer rango empieza en 0 años.' });
    c.rangosEdad.forEach((r, i) => {
      const anterior = c.rangosEdad[i - 1];
      if (anterior && r.desdeAnios <= anterior.desdeAnios)
        errores.push({
          campo: 'rangosEdad',
          mensaje: 'Ordena los rangos de menor a mayor antigüedad, sin repetir.',
        });
    });
    c.distinciones.forEach((d, i) => {
      const anterior = c.distinciones[i - 1];
      if (anterior && d.minimo >= anterior.minimo)
        errores.push({
          campo: 'distinciones',
          mensaje: 'Ordena las distinciones de mayor a menor mínimo, sin repetir.',
        });
    });
    if (errores.length) return invalido(errores);
    const version: VersionCriterios = {
      ...c,
      id: crypto.randomUUID(),
      vigenteDesde: ahora(),
      creadoPor: { id: usuario.id, nombre: usuario.nombre },
    };
    db.criterios.unshift(version);
    return HttpResponse.json({ data: version });
  }),
];
