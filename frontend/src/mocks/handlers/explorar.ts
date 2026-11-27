import { http, HttpResponse } from 'msw';
import { misasPublicas, platicasPublicas, serviciosPublicos } from './misas';
import type { Cartelera } from '@/app/tipos/anuncios';
import type { Iglesia } from '@/app/tipos/iglesias';
import { anioCalculo, anioEfectivo, epoca } from '../datos/indice';
import { IGLESIA_MOCK } from '../datos/b1';
import { db } from '../db';
import { errorApi, paginarMock, ruta } from '../utils';
import { indiceDeIglesia } from './patrimonio';

// Simulación de backend/src/modules/consultas (E2-07, E2-11–E2-13): sin sesión, solo iglesias
// activas y objetos vigentes.

const activas = () => db.iglesias.filter((i) => i.activa);

function delLugar(url: URL) {
  const estado = url.searchParams.get('estado');
  const municipio = url.searchParams.get('municipio');
  const localidad = url.searchParams.get('localidad');
  return (i: Iglesia) =>
    (!estado || i.estado?.clave === estado) &&
    (!municipio || i.municipio?.clave === municipio) &&
    (!localidad || i.localidad?.clave === localidad);
}

const resumen = (i: Iglesia) => {
  const { indice, distincion } = indiceDeIglesia(i.id);
  return {
    id: i.id,
    nombre: i.nombre,
    tipo: i.tipo,
    estado: i.estado ?? null,
    municipio: i.municipio ?? null,
    localidad: i.localidad ?? null,
    foto: i.foto ?? null,
    indice,
    distincion,
  };
};

/**
 * GET /public/iglesias/:id/cartelera (E1-06b). Los anuncios, eventos y horarios de los mocks son de
 * la iglesia de la demo; las demás iglesias activas responden con listas vacías.
 */
function carteleraDe(i: Iglesia): Cartelera {
  const demo = i.id === IGLESIA_MOCK;
  const ya = Date.now();
  return {
    iglesia: {
      nombre: i.nombre,
      logoUrl: null,
      direccion: i.direccion ?? null,
      ciudad: i.municipio?.nombre ?? null,
      telefono: i.telefono ?? null,
      email: i.correo ?? null,
      sitioWeb: null,
    },
    horarios: demo ? db.horarios.filter((h) => h.activo).map(({ activo: _a, ...h }) => h) : [],
    anuncios: demo
      ? db.anuncios
          .filter(
            (a) =>
              Date.parse(a.fechaPublicacion) <= ya &&
              (a.fechaExpiracion === null || Date.parse(a.fechaExpiracion) > ya),
          )
          .map(({ id, titulo, contenido, prioridad, fechaPublicacion, fechaExpiracion }) => ({
            id,
            titulo,
            contenido,
            prioridad,
            fechaPublicacion,
            fechaExpiracion,
          }))
      : [],
    eventosProximos: demo
      ? db.eventos
          .filter((e) => e.estado === 'PROGRAMADO' && Date.parse(e.fechaInicio) >= ya)
          .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
          .slice(0, 10)
          .map(({ id, titulo, descripcion, tipo, categoria, fechaInicio, fechaFin, lugar }) => ({
            id,
            titulo,
            descripcion,
            tipo,
            categoria,
            fechaInicio,
            fechaFin,
            lugar,
          }))
      : [],
  };
}

export const explorarHandlers = [
  http.get(ruta('/public/iglesias/:id/cartelera'), ({ params }) => {
    const i = activas().find((x) => x.id === params['id']);
    if (!i) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    return HttpResponse.json({ data: carteleraDe(i) });
  }),

  http.get(ruta('/public/iglesias'), ({ request }) => {
    const url = new URL(request.url);
    const estado = url.searchParams.get('estado');
    if (!estado || !/^\d{2}$/.test(estado))
      return errorApi(400, 'VALIDATION_ERROR', 'Elige un estado.', [
        { campo: 'estado', mensaje: 'Elige un estado.' },
      ]);
    if (!db.estadosInegi.some((e) => e.clave === estado))
      return errorApi(404, 'NOT_FOUND', 'El estado no existe en el catálogo.');
    const q = url.searchParams.get('q')?.toLowerCase();
    const tipo = url.searchParams.get('tipo');
    const min = Number(url.searchParams.get('capacidadMin') ?? 0);
    const max = Number(url.searchParams.get('capacidadMax') ?? 0);
    const lista = activas()
      .filter(delLugar(url))
      .filter((i) => !tipo || i.tipo === tipo)
      .filter((i) => !q || i.nombre.toLowerCase().includes(q))
      .filter(
        (i) =>
          (!min && !max) ||
          (i.capacidad != null && (!min || i.capacidad >= min) && (!max || i.capacidad <= max)),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((i) => {
        const { estado: _e, ...resto } = resumen(i);
        return { ...resto, direccion: i.direccion ?? null, capacidad: i.capacidad ?? null };
      });
    return paginarMock(lista, url);
  }),

  http.get(ruta('/public/iglesias/:id'), ({ params }) => {
    const i = activas().find((x) => x.id === params['id']);
    if (!i) return errorApi(404, 'NOT_FOUND', 'La iglesia no existe.');
    const { indice, distincion, anioCalculo: anio } = indiceDeIglesia(i.id);
    return HttpResponse.json({
      data: {
        id: i.id,
        nombre: i.nombre,
        tipo: i.tipo,
        ubicacion: {
          direccion: i.direccion ?? null,
          estado: i.estado ?? null,
          municipio: i.municipio ?? null,
          localidad: i.localidad ?? null,
        },
        capacidad: i.capacidad ?? null,
        anioConstruccion: i.anioConstruccion ?? null,
        contacto: { telefono: i.telefono ?? null, correo: i.correo ?? null },
        foto: i.foto ?? null,
        ...(i.latitud &&
          i.longitud && { coordenadas: { latitud: i.latitud, longitud: i.longitud } }),
        indice,
        distincion,
        anioCalculo: anio,
        objetos: db.objetos
          .filter((o) => o.iglesiaId === i.id && o.estado === 'VIGENTE')
          .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
          .map((o) => ({
            id: o.id,
            descripcion: o.descripcion,
            tipo: o.tipo,
            anio: o.anio,
            siglo: o.siglo,
            epoca: epoca(o),
            material: o.material,
            catalogadoInah: o.catalogadoInah,
          })),
        // E3-18 (Genaro)
        servicios: serviciosPublicos(i.id),
        platicas: platicasPublicas(i.id),
        misas: misasPublicas(i.id),
        tiposEspacio: db.tiposEspacio
          .filter((t) => t.iglesiaId === i.id && t.activo && t.disponible)
          .map((t) => ({ id: t.id, clase: t.clase })),
      },
    });
  }),

  http.get(ruta('/public/reconocidas'), ({ request }) => {
    const url = new URL(request.url);
    const ranking = activas()
      .filter(delLugar(url))
      .filter((i) => db.objetos.some((o) => o.iglesiaId === i.id && o.estado === 'VIGENTE'))
      .map(resumen)
      .sort((a, b) => b.indice - a.indice || a.nombre.localeCompare(b.nombre))
      .map((i, n) => ({ posicion: n + 1, ...i }));
    return paginarMock(ranking, url);
  }),

  http.get(ruta('/public/busqueda-patrimonio'), ({ request }) => {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipoObjeto');
    const minimo = Number(url.searchParams.get('antiguedadMin'));
    const hayLugar = ['estado', 'municipio', 'localidad'].some((k) => url.searchParams.get(k));
    if (!tipo || !hayLugar || Number.isNaN(minimo) || minimo < 0)
      return errorApi(400, 'VALIDATION_ERROR', 'Elige un tipo, una antigüedad y un lugar.');
    const resultados = activas()
      .filter(delLugar(url))
      .map((i) => ({
        ...resumen(i),
        objetos: db.objetos
          .filter((o) => o.iglesiaId === i.id && o.estado === 'VIGENTE' && o.tipo === tipo)
          .map((o) => ({
            id: o.id,
            descripcion: o.descripcion,
            epoca: epoca(o),
            antiguedad: anioCalculo() - anioEfectivo(o),
          }))
          .filter((o) => o.antiguedad >= minimo),
      }))
      .filter((r) => r.objetos.length > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return paginarMock(resultados, url);
  }),
];
