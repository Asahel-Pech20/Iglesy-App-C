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
  QueryListaPublica,
  QueryListarIglesias,
} from './iglesias.schemas';

const LUGAR = { select: { clave: true, nombre: true } } as const;

/** Columnas de la foto; en la respuesta van juntas en `foto` (o `foto: null` si no hay). */
const FOTO = {
  fotoUrl: true,
  fotoAutor: true,
  fotoLicencia: true,
  fotoLicenciaUrl: true,
  fotoEnlace: true,
} as const satisfies Prisma.IglesiaSelect;

interface ColumnasFoto {
  fotoUrl: string | null;
  fotoAutor: string | null;
  fotoLicencia: string | null;
  fotoLicenciaUrl: string | null;
  fotoEnlace: string | null;
}

/** Saca las columnas de la foto y las devuelve como `foto: { url, autor, licencia, … }`. */
export function conFoto<T extends ColumnasFoto>(fila: T) {
  const { fotoUrl, fotoAutor, fotoLicencia, fotoLicenciaUrl, fotoEnlace, ...resto } = fila;
  return {
    ...resto,
    foto: fotoUrl
      ? {
          url: fotoUrl,
          autor: fotoAutor,
          licencia: fotoLicencia,
          licenciaUrl: fotoLicenciaUrl,
          enlace: fotoEnlace,
        }
      : null,
  };
}

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
  ...FOTO,
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
    ...conFoto(i),
    latitud: i.latitud?.toFixed(6) ?? null,
    longitud: i.longitud?.toFixed(6) ?? null,
    fechaCierre: i.fechaCierre?.toISOString().slice(0, 10) ?? null,
  };
}

/** Fecha de hoy (`yyyy-MM-dd`) en la zona horaria de la iglesia. */
function hoyEn(zonaHoraria: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(new Date());
}

/** Datos de entrada → columnas de Prisma: las coordenadas se guardan como texto con 6 decimales. */
function aColumnas<T extends { latitud?: number | null; longitud?: number | null }>(d: T) {
  const { latitud, longitud, ...resto } = d;
  return {
    ...resto,
    ...(latitud !== undefined && { latitud: latitud === null ? null : latitud.toFixed(6) }),
    ...(longitud !== undefined && { longitud: longitud === null ? null : longitud.toFixed(6) }),
  };
}

/**
 * A2-E2-01: latitud y longitud van juntas también contra lo guardado. Zod solo ve lo que llega;
 * sin esto, `{ latitud: null }` en una iglesia con coordenadas violaría el CHECK y daría 500.
 */
function validarCoordenadas(
  cambios: { latitud?: number | null; longitud?: number | null },
  actual: { latitud: unknown; longitud: unknown },
) {
  const latitud = cambios.latitud !== undefined ? cambios.latitud : actual.latitud;
  const longitud = cambios.longitud !== undefined ? cambios.longitud : actual.longitud;
  if ((latitud === null) === (longitud === null)) return;
  const falta = latitud === null ? 'latitud' : 'longitud';
  throw AppError.validacion('Escribe latitud y longitud juntas.', [
    { campo: falta, mensaje: 'Escribe latitud y longitud juntas.' },
  ]);
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

/**
 * A2-E2-06 (decisión de Oscar, 2026-11-21): el nombre es único **por municipio**, sin distinguir
 * mayúsculas; dos «Parroquia de San Miguel» en municipios distintos son válidas. Las iglesias sin
 * municipio se comparan entre sí. La BD lo respalda con el índice iglesias_nombre_por_municipio.
 */
async function nombreRepetido(nombre: string, municipioClave: string | null, exceptoId?: string) {
  const repetida = await prisma.iglesia.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      municipioClave,
      ...(exceptoId && { id: { not: exceptoId } }),
    },
    select: { id: true },
  });
  if (repetida) {
    throw AppError.conflicto('Ya existe una iglesia con ese nombre en el municipio.', [
      { campo: 'nombre', mensaje: 'Ya existe una iglesia con ese nombre en el municipio.' },
    ]);
  }
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

/** Lo que ve el visitante en la lista: sin contacto, coordenadas ni datos de cierre. */
const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  tipo: true,
  zonaHoraria: true,
  direccion: true,
  capacidad: true,
  ...FOTO,
  municipio: LUGAR,
  localidad: LUGAR,
} satisfies Prisma.IglesiaSelect;

/**
 * E2-07 (RF-01–RF-05, CA-02, CA-03, RN-07): iglesias ACTIVAS de un estado, con filtros.
 * 404 si el estado no está en el catálogo. La distinción del índice (RF-18) llega con E2-10.
 */
export async function listarPublicas(query: QueryListaPublica) {
  const estadoClave = query.estado;
  await catalogosService.obtenerEstado(estadoClave);
  const { page, limit, skip, take } = paginar(query);
  const hayCapacidad = query.capacidadMin !== undefined || query.capacidadMax !== undefined;
  const where: Prisma.IglesiaWhereInput = {
    activa: true,
    estadoClave,
    ...(query.municipio && { municipioClave: query.municipio }),
    ...(query.localidad && { localidadClave: query.localidad }),
    ...(query.tipo && { tipo: query.tipo }),
    ...(query.q && { nombre: { contains: query.q, mode: 'insensitive' } }),
    // Con filtro de capacidad, las iglesias sin capacidad registrada no aparecen
    ...(hayCapacidad && { capacidad: { gte: query.capacidadMin, lte: query.capacidadMax } }),
  };
  const [total, datos] = await Promise.all([
    prisma.iglesia.count({ where }),
    prisma.iglesia.findMany({
      where,
      select: SELECT_PUBLICO,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip,
      take,
    }),
  ]);
  return { datos: datos.map(conFoto), meta: crearMeta(total, page, limit) };
}

/**
 * E2-11 (RF-06): datos públicos de una iglesia ACTIVA para su ficha. 404 si no existe o está
 * cerrada (RN-07). Las coordenadas se omiten si no se conocen.
 */
export async function obtenerPublica(id: string) {
  const i = await prisma.iglesia.findFirst({
    where: { id, activa: true },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      zonaHoraria: true,
      direccion: true,
      capacidad: true,
      anioConstruccion: true,
      telefono: true,
      correo: true,
      latitud: true,
      longitud: true,
      ...FOTO,
      estado: LUGAR,
      municipio: LUGAR,
      localidad: LUGAR,
    },
  });
  if (!i) throw AppError.noEncontrado('La iglesia no existe.');
  return {
    id: i.id,
    nombre: i.nombre,
    tipo: i.tipo,
    zonaHoraria: i.zonaHoraria,
    ubicacion: {
      direccion: i.direccion,
      estado: i.estado,
      municipio: i.municipio,
      localidad: i.localidad,
    },
    capacidad: i.capacidad,
    anioConstruccion: i.anioConstruccion,
    contacto: { telefono: i.telefono, correo: i.correo },
    foto: conFoto(i).foto,
    ...(i.latitud &&
      i.longitud && {
        coordenadas: { latitud: i.latitud.toFixed(6), longitud: i.longitud.toFixed(6) },
      }),
  };
}

/** Un solo nivel de lugar (estado, municipio o localidad). Sin ninguno, todo el país. */
export interface LugarPublico {
  estado?: string;
  municipio?: string;
  localidad?: string;
}

/**
 * E2-12 y E2-13: iglesias ACTIVAS de un lugar con lo que necesitan el ranking y la búsqueda.
 * Sin paginar: quien llama calcula el índice, ordena y pagina (plan-nataly.md, «Ranking»).
 */
export async function activasDelLugar(lugar: LugarPublico) {
  const filas = await prisma.iglesia.findMany({
    where: {
      activa: true,
      ...(lugar.estado && { estadoClave: lugar.estado }),
      ...(lugar.municipio && { municipioClave: lugar.municipio }),
      ...(lugar.localidad && { localidadClave: lugar.localidad }),
    },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      zonaHoraria: true,
      estado: LUGAR,
      municipio: LUGAR,
      localidad: LUGAR,
      ...FOTO,
    },
    orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
  });
  return filas.map(conFoto);
}

export async function crear(datos: CrearIglesia) {
  const { estado = null, municipio = null, localidad = null, ...resto } = datos;
  await nombreRepetido(datos.nombre, municipio);
  await catalogosService.validarUbicacion({ estado, municipio, localidad });
  const creada = await prisma.iglesia.create({
    data: { ...aColumnas(resto), ...columnasUbicacion({ estado, municipio, localidad }) },
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
    select: {
      nombre: true,
      activa: true,
      estadoClave: true,
      municipioClave: true,
      localidadClave: true,
      latitud: true,
      longitud: true,
    },
  });
  if (!actual) throw AppError.noEncontrado('La iglesia no existe.');
  if (!actual.activa) throw AppError.reglaNegocio('La iglesia está cerrada; no se puede editar.');
  validarCoordenadas(cambios, actual);

  const { estado, municipio, localidad, ...resto } = cambios;
  let ubicacion: ReturnType<typeof columnasUbicacion> | Record<string, never> = {};
  if (estado !== undefined || municipio !== undefined || localidad !== undefined) {
    // A2-E2-03: solo un cambio REAL de estado deja sin municipio (y de municipio, sin localidad).
    // Reenviar el mismo estado guardado, como hace un formulario completo, no borra la ubicación.
    const cambiaEstado = estado !== undefined && estado !== actual.estadoClave;
    const nuevoEstado = estado !== undefined ? estado : actual.estadoClave;
    const nuevoMunicipio =
      municipio !== undefined ? municipio : cambiaEstado ? null : actual.municipioClave;
    const cambiaMunicipio = nuevoMunicipio !== actual.municipioClave;
    const nueva = {
      estado: nuevoEstado,
      municipio: nuevoMunicipio,
      localidad:
        localidad !== undefined ? localidad : cambiaMunicipio ? null : actual.localidadClave,
    };
    await catalogosService.validarUbicacion(nueva);
    ubicacion = columnasUbicacion(nueva);
  }
  // A2-E2-06: se revisa si cambia el nombre **o** el municipio (al mudarla puede chocar con otra)
  const municipioFinal =
    'municipioClave' in ubicacion ? ubicacion.municipioClave : actual.municipioClave;
  if (cambios.nombre || municipioFinal !== actual.municipioClave) {
    await nombreRepetido(cambios.nombre ?? actual.nombre, municipioFinal, id);
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
