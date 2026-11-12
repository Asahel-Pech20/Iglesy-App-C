// Catálogo del INEGI (E2-05): estados, municipios y localidades con sus claves oficiales.
import { AppError, type DetalleError } from '../../lib/appError';
import { prisma } from '../../lib/prisma';
import type { FilaCatalogo } from './catalogos.schemas';

const SELECT = { clave: true, nombre: true } as const;

export function listarEstados() {
  return prisma.estado.findMany({ select: SELECT, orderBy: { clave: 'asc' } });
}

export async function municipiosDe(estadoClave: string) {
  const estado = await prisma.estado.findUnique({ where: { clave: estadoClave }, select: SELECT });
  if (!estado) throw AppError.noEncontrado('El estado no existe en el catálogo.');
  return prisma.municipio.findMany({
    where: { estadoClave },
    select: SELECT,
    orderBy: { nombre: 'asc' },
  });
}

export async function localidadesDe(municipioClave: string) {
  const municipio = await prisma.municipio.findUnique({
    where: { clave: municipioClave },
    select: SELECT,
  });
  if (!municipio) throw AppError.noEncontrado('El municipio no existe en el catálogo.');
  return prisma.localidad.findMany({
    where: { municipioClave },
    select: SELECT,
    orderBy: { nombre: 'asc' },
  });
}

export interface Ubicacion {
  estado?: string | null;
  municipio?: string | null;
  localidad?: string | null;
}

/**
 * RN-09: cada clave existe en el catálogo, el municipio es del estado y la localidad del municipio.
 * Lanza 400 con el campo que falla. Lo usan iglesias (y cualquier módulo que guarde una ubicación).
 */
export async function validarUbicacion({ estado, municipio, localidad }: Ubicacion) {
  const errores: DetalleError[] = [];
  if (municipio && !estado) errores.push({ campo: 'estado', mensaje: 'Elige el estado.' });
  if (localidad && !municipio) errores.push({ campo: 'municipio', mensaje: 'Elige el municipio.' });
  if (errores.length) throw AppError.validacion('La ubicación está incompleta.', errores);

  const [e, m, l] = await Promise.all([
    estado ? prisma.estado.findUnique({ where: { clave: estado }, select: { clave: true } }) : null,
    municipio
      ? prisma.municipio.findUnique({
          where: { clave: municipio },
          select: { estadoClave: true },
        })
      : null,
    localidad
      ? prisma.localidad.findUnique({
          where: { clave: localidad },
          select: { municipioClave: true },
        })
      : null,
  ]);
  if (estado && !e) errores.push({ campo: 'estado', mensaje: 'El estado no está en el catálogo.' });
  if (municipio && !m)
    errores.push({ campo: 'municipio', mensaje: 'El municipio no está en el catálogo.' });
  else if (m && m.estadoClave !== estado)
    errores.push({ campo: 'municipio', mensaje: 'El municipio no pertenece al estado elegido.' });
  if (localidad && !l)
    errores.push({ campo: 'localidad', mensaje: 'La localidad no está en el catálogo.' });
  else if (l && l.municipioClave !== municipio)
    errores.push({
      campo: 'localidad',
      mensaje: 'La localidad no pertenece al municipio elegido.',
    });
  if (errores.length)
    throw AppError.validacion('La ubicación no coincide con el catálogo del INEGI.', errores);
}

/**
 * RF-10: carga o actualiza el catálogo. Inserta lo nuevo y actualiza el nombre de lo existente;
 * nunca borra (una clave puede estar en uso por una iglesia). Todo o nada, en una transacción.
 */
export async function importar(filas: FilaCatalogo[]) {
  const estados = new Map<string, string>();
  const municipios = new Map<string, { estado: string; nombre: string }>();
  const localidades = new Map<string, { municipio: string; nombre: string }>();
  for (const f of filas) {
    estados.set(f.cveEnt, f.nomEnt);
    if (f.cveMun && f.nomMun) {
      const mun = f.cveEnt + f.cveMun;
      municipios.set(mun, { estado: f.cveEnt, nombre: f.nomMun });
      if (f.cveLoc && f.nomLoc)
        localidades.set(mun + f.cveLoc, { municipio: mun, nombre: f.nomLoc });
    }
  }

  // Un municipio de un estado que no viene en el archivo debe existir ya en el catálogo
  const estadosFaltantes = [...new Set([...municipios.values()].map((m) => m.estado))].filter(
    (clave) => !estados.has(clave),
  );
  if (estadosFaltantes.length) {
    const existentes = await prisma.estado.count({ where: { clave: { in: estadosFaltantes } } });
    if (existentes !== estadosFaltantes.length)
      throw AppError.validacion('Hay municipios de estados que no están en el catálogo.');
  }

  const [e, m, l] = await prisma.$transaction(async (tx) => {
    const totalEstados = await tx.$executeRaw`
      INSERT INTO "estados" ("clave", "nombre")
      SELECT * FROM unnest(${[...estados.keys()]}::text[], ${[...estados.values()]}::text[])
      ON CONFLICT ("clave") DO UPDATE SET "nombre" = EXCLUDED."nombre"
      WHERE "estados"."nombre" IS DISTINCT FROM EXCLUDED."nombre"`;
    const listaMun = [...municipios.entries()];
    const totalMunicipios = listaMun.length
      ? await tx.$executeRaw`
      INSERT INTO "municipios" ("clave", "estadoClave", "nombre")
      SELECT * FROM unnest(${listaMun.map(([c]) => c)}::text[],
                           ${listaMun.map(([, v]) => v.estado)}::text[],
                           ${listaMun.map(([, v]) => v.nombre)}::text[])
      ON CONFLICT ("clave") DO UPDATE SET "nombre" = EXCLUDED."nombre"
      WHERE "municipios"."nombre" IS DISTINCT FROM EXCLUDED."nombre"`
      : 0;
    const listaLoc = [...localidades.entries()];
    const totalLocalidades = listaLoc.length
      ? await tx.$executeRaw`
      INSERT INTO "localidades" ("clave", "municipioClave", "nombre")
      SELECT * FROM unnest(${listaLoc.map(([c]) => c)}::text[],
                           ${listaLoc.map(([, v]) => v.municipio)}::text[],
                           ${listaLoc.map(([, v]) => v.nombre)}::text[])
      ON CONFLICT ("clave") DO UPDATE SET "nombre" = EXCLUDED."nombre"
      WHERE "localidades"."nombre" IS DISTINCT FROM EXCLUDED."nombre"`
      : 0;
    return [totalEstados, totalMunicipios, totalLocalidades];
  });

  // Filas insertadas o con nombre cambiado; las que ya estaban igual no cuentan
  return {
    leidas: { estados: estados.size, municipios: municipios.size, localidades: localidades.size },
    cambiadas: { estados: e, municipios: m, localidades: l },
  };
}
