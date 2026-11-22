import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { AppError } from '../../lib/appError';
import { conIglesia, iglesiaDelContexto } from '../../lib/contextoIglesia';
import { prisma } from '../../lib/prisma';
import type { CrearHorario, DatosConfiguracion, EditarHorario } from './configuracion.schemas';

export const RUTA_UPLOADS = '/uploads';
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const urlPublica = () => env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}`;

// E1-06b: la configuración es la de la IGLESIA del contexto (antes, una fila única para todas).
// El contrato de la respuesta no cambia: nombre, logoUrl, direccion, ciudad, telefono, email,
// sitioWeb, moneda y zonaHoraria.
const SELECT_INSTITUCIONAL = {
  id: true,
  nombre: true,
  logoUrl: true,
  direccion: true,
  telefono: true,
  correo: true,
  sitioWeb: true,
  moneda: true,
  zonaHoraria: true,
  municipio: { select: { nombre: true } },
} as const;

type FilaInstitucional = {
  nombre: string;
  logoUrl: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  sitioWeb: string | null;
  moneda: string;
  zonaHoraria: string;
  municipio: { nombre: string } | null;
};

/** En BD se guarda la ruta relativa (/uploads/x.png); la API devuelve la URL absoluta. */
function aRespuesta(fila: FilaInstitucional) {
  return {
    nombre: fila.nombre,
    logoUrl: fila.logoUrl ? new URL(fila.logoUrl, urlPublica()).href : null,
    direccion: fila.direccion,
    // La ciudad sale del municipio del catálogo del INEGI (ficha de la iglesia, Nataly)
    ciudad: fila.municipio?.nombre ?? null,
    telefono: fila.telefono,
    email: fila.correo,
    sitioWeb: fila.sitioWeb,
    moneda: fila.moneda,
    zonaHoraria: fila.zonaHoraria,
  };
}

export type Configuracion = ReturnType<typeof aRespuesta>;

/** Valores por omisión cuando todavía no hay ninguna iglesia (instalación nueva sin seed). */
export const CONFIGURACION_SIN_IGLESIAS: Configuracion = {
  nombre: 'Mi Iglesia',
  logoUrl: null,
  direccion: null,
  ciudad: null,
  telefono: null,
  email: null,
  sitioWeb: null,
  moneda: 'MXN',
  zonaHoraria: 'America/Mexico_City',
};

async function filaDeLaIglesia() {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaDelContexto('configuración') },
    select: SELECT_INSTITUCIONAL,
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  return iglesia;
}

/**
 * Configuración de la iglesia del CONTEXTO (la del usuario en una petición). Sin contexto de
 * iglesia lanza: nunca cae en silencio en la iglesia inicial. Las rutas públicas eligen la iglesia
 * de forma explícita (`enIglesiaInicial` o `obtenerDe`).
 * La usan otros módulos para la moneda y la zona horaria (`zonaIglesia`, `hoyIglesia`).
 */
export async function obtener() {
  return aRespuesta(await filaDeLaIglesia());
}

/** Ejecuta `fn` en una iglesia indicada (Coordinación o visitante); 404 si no existe. */
export async function enIglesia<T>(iglesiaId: string, fn: () => Promise<T>): Promise<T> {
  const existe = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { id: true },
  });
  if (!existe) throw AppError.noEncontrado('La iglesia no existe.');
  return conIglesia(iglesiaId, fn);
}

/**
 * PUT /configuracion (E1-06b): solo lo institucional de la iglesia del usuario. Nombre, dirección y
 * contacto se editan en la ficha de la iglesia (PATCH /iglesias/:id, Nataly); el esquema los rechaza.
 */
export async function actualizar(datos: DatosConfiguracion) {
  const iglesia = await prisma.iglesia.update({
    where: { id: iglesiaDelContexto('configuración') },
    data: datos,
    select: SELECT_INSTITUCIONAL,
  });
  return aRespuesta(iglesia);
}

// ───────── Logotipo ─────────

type TipoLogo = { ext: string; esValido: (b: Buffer) => boolean };

// El MIME lo envía el cliente: se comprueba también la firma real del archivo
const TIPOS_LOGO: Record<string, TipoLogo> = {
  'image/png': {
    ext: 'png',
    esValido: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
  'image/jpeg': {
    ext: 'jpg',
    esValido: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  'image/webp': {
    ext: 'webp',
    esValido: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  'image/svg+xml': { ext: 'svg', esValido: (b) => /<svg[\s>]/i.test(b.toString('utf8', 0, 4096)) },
};

// SVG con código activo se rechaza (AGENTS.md: sanitizar o rechazar)
const SVG_PELIGROSO = /<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/i;

export const MIMES_LOGO = Object.keys(TIPOS_LOGO);

export async function guardarLogo(archivo: { mimetype: string; buffer: Buffer } | undefined) {
  if (!archivo) {
    throw AppError.validacion('Debes adjuntar un archivo.', [
      { campo: 'logo', mensaje: 'Debes adjuntar un archivo.' },
    ]);
  }
  const tipo = TIPOS_LOGO[archivo.mimetype];
  if (!tipo || !tipo.esValido(archivo.buffer)) {
    throw AppError.validacion('Formato no permitido. Usa PNG, JPG, WEBP o SVG.');
  }
  if (tipo.ext === 'svg' && SVG_PELIGROSO.test(archivo.buffer.toString('utf8'))) {
    throw AppError.validacion('El SVG contiene código no permitido.');
  }

  const carpeta = path.resolve(env.UPLOAD_DIR);
  await mkdir(carpeta, { recursive: true });
  // Nombre UUID: nunca se usa el nombre original del archivo
  const nombre = `${randomUUID()}.${tipo.ext}`;
  await writeFile(path.join(carpeta, nombre), archivo.buffer);

  const anterior = (await filaDeLaIglesia()).logoUrl;
  const config = await prisma.iglesia.update({
    where: { id: iglesiaDelContexto('logo') },
    data: { logoUrl: `${RUTA_UPLOADS}/${nombre}` },
    select: SELECT_INSTITUCIONAL,
  });
  if (anterior?.startsWith(`${RUTA_UPLOADS}/`)) {
    await unlink(path.join(carpeta, path.basename(anterior))).catch(() => undefined);
  }
  return aRespuesta(config);
}

// ───────── Iglesia de las páginas públicas heredadas (E1-06; E1-06b las hace por iglesia) ─────────

/**
 * La iglesia inicial: la más antigua, la misma a la que la migración pasó los datos de AppIglesia
 * (supuesto S-03). La cartelera y los horarios públicos la usan hasta E1-06b.
 */
export async function iglesiaInicial(): Promise<string | null> {
  const iglesia = await prisma.iglesia.findFirst({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  return iglesia?.id ?? null;
}

/** ¿Existe y está abierta? Las cerradas no aparecen en lo público (RN-07). */
export async function esIglesiaPublica(iglesiaId: string): Promise<boolean> {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { activa: true },
  });
  return iglesia?.activa === true;
}

/** Ejecuta `fn` con la gestión interna de la iglesia inicial; sin iglesias, devuelve `vacio`. */
export async function enIglesiaInicial<T>(fn: () => Promise<T>, vacio: T): Promise<T> {
  const iglesiaId = await iglesiaInicial();
  return iglesiaId ? conIglesia(iglesiaId, fn) : vacio;
}

// ───────── Horarios ─────────

export function listarHorarios() {
  return prisma.horarioReunion.findMany({
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    omit: OMITIR_HORARIO,
  });
}

// E1-06: iglesiaId es interno; el contrato de horarios no cambia
const OMITIR_HORARIO = { createdAt: true, updatedAt: true, iglesiaId: true } as const;

function validarHoras(h: { horaInicio: string; horaFin: string | null }) {
  if (h.horaFin && h.horaFin <= h.horaInicio) {
    const mensaje = 'La hora de fin debe ser posterior a la de inicio.';
    throw AppError.validacion('Los datos enviados no son válidos.', [
      { campo: 'horaFin', mensaje },
    ]);
  }
}

export function crearHorario(datos: CrearHorario) {
  return prisma.horarioReunion.create({
    data: { ...datos, iglesiaId: iglesiaDelContexto('HorarioReunion') },
    omit: OMITIR_HORARIO,
  });
}

async function horarioOFallar(id: string) {
  const horario = await prisma.horarioReunion.findUnique({ where: { id } });
  if (!horario) throw AppError.noEncontrado('El horario no existe.');
  return horario;
}

export async function editarHorario(id: string, datos: EditarHorario) {
  const actual = await horarioOFallar(id);
  validarHoras({ ...actual, ...datos });
  return prisma.horarioReunion.update({
    where: { id },
    data: datos,
    omit: OMITIR_HORARIO,
  });
}

export async function eliminarHorario(id: string) {
  await horarioOFallar(id);
  await prisma.horarioReunion.delete({ where: { id } });
}
