// Iglesias: base mínima de Oscar (listar, crear) ampliada en E2-06 (Nataly) con ubicación del INEGI,
// datos de la ficha, edición y cierre sin borrar la historia (RF-07, RF-08, RF-11, RF-12, RN-07–RN-09).
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import * as catalogosService from '../catalogos/catalogos.service';
import type {
  CerrarIglesia,
  CrearIglesia,
  EditarIglesia,
  QueryListarIglesias,
} from './iglesias.schemas';

const LUGAR = { select: { clave: true, nombre: true } } as const;

const SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  zonaHoraria: true,
  activa: true,
  direccion: true,
  capacidad: true,
  anioConstruccion: true,
  telefono: true,
  correo: true,
  latitud: true,
  longitud: true,
  fechaCierre: true,
  motivoCierre: true,
  estado: LUGAR,
  municipio: LUGAR,
  localidad: LUGAR,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IglesiaSelect;

type FilaIglesia = Prisma.IglesiaGetPayload<{ select: typeof SELECT }>;

/** Coordenadas como texto con 6 decimales y fecha de cierre como `yyyy-MM-dd` (specs.md §7.1). */
function formatear(i: FilaIglesia) {
  return {
    ...i,
    latitud: i.latitud?.toFixed(6) ?? null,
    longitud: i.longitud?.toFixed(6) ?? null,
    fechaCierre: i.fechaCierre?.toISOString().slice(0, 10) ?? null,
  };
}

/** Fecha de hoy (`yyyy-MM-dd`) en la zona horaria de la iglesia. */
function hoyEn(zonaHoraria: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(new Date());
}

/** Datos de entrada → columnas de Prisma (las claves del catálogo se guardan en sus relaciones). */
function aColumnas(d: Omit<EditarIglesia, 'estado' | 'municipio' | 'localidad'>) {
  const { latitud, longitud, ...resto } = d;
  return {
    ...resto,
    ...(latitud !== undefined && { latitud: latitud === null ? null : latitud.toFixed(6) }),
    ...(longitud !== undefined && { longitud: longitud === null ? null : longitud.toFixed(6) }),
  };
}

/**
 * Las tres claves se escriben en el MISMO UPDATE: con connect/disconnect Prisma las cambia una por una
 * y el CHECK iglesias_ubicacion_consistente ve un estado nuevo con el municipio viejo.
 */
function columnasUbicacion(u: {
  estado: string | null;
  municipio: string | null;
  localidad: string | null;
}) {
  return { estadoClave: u.estado, municipioClave: u.municipio, localidadClave: u.localidad };
}

async function nombreRepetido(nombre: string, exceptoId?: string) {
  const repetida = await prisma.iglesia.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      ...(exceptoId && { id: { not: exceptoId } }),
    },
    select: { id: true },
  });
  // Regla de la base de Oscar: nombre único en el país. Propuesta en plan-nataly.md: por municipio.
  if (repetida) throw AppError.conflicto('Ya existe una iglesia con ese nombre.');
}

export async function listar(query: QueryListarIglesias) {
  const { page, limit, skip, take } = paginar(query);
  const where: Prisma.IglesiaWhereInput = {
    ...(query.q && { nombre: { contains: query.q, mode: 'insensitive' } }),
    ...(query.estado && { estadoClave: query.estado }),
    ...(query.municipio && { municipioClave: query.municipio }),
    ...(query.tipo && { tipo: query.tipo }),
    ...(query.situacion !== 'todas' && { activa: query.situacion === 'activas' }),
  };
  const [total, datos] = await Promise.all([
    prisma.iglesia.count({ where }),
    prisma.iglesia.findMany({ where, select: SELECT, orderBy: { nombre: 'asc' }, skip, take }),
  ]);
  return { datos: datos.map(formatear), meta: crearMeta(total, page, limit) };
}

export async function crear(datos: CrearIglesia) {
  await nombreRepetido(datos.nombre);
  const { estado = null, municipio = null, localidad = null, ...resto } = datos;
  await catalogosService.validarUbicacion({ estado, municipio, localidad });
  const creada = await prisma.iglesia.create({
    data: {
      ...aColumnas(resto),
      nombre: resto.nombre,
      tipo: resto.tipo,
      ...columnasUbicacion({ estado, municipio, localidad }),
    },
    select: SELECT,
  });
  return formatear(creada);
}

export async function obtener(id: string) {
  const iglesia = await prisma.iglesia.findUnique({ where: { id }, select: SELECT });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return formatear(iglesia);
}

/** RF-08: la Coordinación o el administrador de esa iglesia (alcanceIglesia) cambian sus datos. */
export async function editar(id: string, cambios: EditarIglesia) {
  const actual = await prisma.iglesia.findUnique({
    where: { id },
    select: { activa: true, estadoClave: true, municipioClave: true, localidadClave: true },
  });
  if (!actual) throw AppError.noEncontrado('La iglesia no existe.');
  if (!actual.activa) throw AppError.reglaNegocio('La iglesia está cerrada; no se puede editar.');
  if (cambios.nombre) await nombreRepetido(cambios.nombre, id);

  const { estado, municipio, localidad, ...resto } = cambios;
  const tocaUbicacion = estado !== undefined || municipio !== undefined || localidad !== undefined;
  let ubicacion: ReturnType<typeof columnasUbicacion> | Record<string, never> = {};
  if (tocaUbicacion) {
    // Cambiar el estado sin mandar municipio deja de valer el municipio anterior (y su localidad)
    const nueva = {
      estado: estado !== undefined ? estado : actual.estadoClave,
      municipio:
        municipio !== undefined ? municipio : estado !== undefined ? null : actual.municipioClave,
      localidad:
        localidad !== undefined
          ? localidad
          : estado !== undefined || municipio !== undefined
            ? null
            : actual.localidadClave,
    };
    await catalogosService.validarUbicacion(nueva);
    ubicacion = columnasUbicacion(nueva);
  }

  const editada = await prisma.iglesia.update({
    where: { id },
    data: { ...aColumnas(resto), ...ubicacion },
    select: SELECT,
  });
  return formatear(editada);
}

/** RF-11, RN-07: se cierra con fecha y motivo; no se borra nada y deja de aparecer en el público. */
export async function cerrar(id: string, { fecha, motivo }: CerrarIglesia) {
  const actual = await prisma.iglesia.findUnique({
    where: { id },
    select: { activa: true, zonaHoraria: true },
  });
  if (!actual) throw AppError.noEncontrado('La iglesia no existe.');
  if (!actual.activa) throw AppError.reglaNegocio('La iglesia ya está cerrada.');
  if (fecha > hoyEn(actual.zonaHoraria))
    throw AppError.validacion('La fecha de cierre no puede ser futura.', [
      { campo: 'fecha', mensaje: 'La fecha de cierre no puede ser futura.' },
    ]);
  const cerrada = await prisma.iglesia.update({
    where: { id },
    data: { activa: false, fechaCierre: new Date(`${fecha}T00:00:00.000Z`), motivoCierre: motivo },
    select: SELECT,
  });
  return formatear(cerrada);
}

/**
 * Para otros módulos (servicios, misas, espacios): la iglesia existe y no está cerrada.
 * 404 si no existe; 422 si está cerrada.
 */
export async function obtenerActiva(id: string) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id },
    select: { id: true, nombre: true, zonaHoraria: true, activa: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  if (!iglesia.activa) throw AppError.reglaNegocio('La iglesia está cerrada.');
  return { id: iglesia.id, nombre: iglesia.nombre, zonaHoraria: iglesia.zonaHoraria };
}
