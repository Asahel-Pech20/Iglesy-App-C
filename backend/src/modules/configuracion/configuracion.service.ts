import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import type { ConfiguracionIglesia } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { conIglesia, iglesiaDelContexto } from '../../lib/contextoIglesia';
import { prisma } from '../../lib/prisma';
import type { CrearHorario, DatosConfiguracion, EditarHorario } from './configuracion.schemas';

const ID_CONFIG = 1;
export const RUTA_UPLOADS = '/uploads';
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const urlPublica = () => env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}`;

/** En BD se guarda la ruta relativa (/uploads/x.png); la API devuelve la URL absoluta. */
function aRespuesta({ id: _id, createdAt: _c, updatedAt: _u, ...config }: ConfiguracionIglesia) {
  return {
    ...config,
    logoUrl: config.logoUrl ? new URL(config.logoUrl, urlPublica()).href : null,
  };
}

async function obtenerFila() {
  // Si el seed no se corrió, la fila se crea con los valores por defecto
  return prisma.configuracionIglesia.upsert({
    where: { id: ID_CONFIG },
    create: { id: ID_CONFIG, nombre: 'Mi Iglesia' },
    update: {},
  });
}

export async function obtener() {
  return aRespuesta(await obtenerFila());
}

export async function actualizar(datos: DatosConfiguracion) {
  await obtenerFila();
  const config = await prisma.configuracionIglesia.update({
    where: { id: ID_CONFIG },
    data: datos,
  });
  return aRespuesta(config);
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

  const anterior = (await obtenerFila()).logoUrl;
  const config = await prisma.configuracionIglesia.update({
    where: { id: ID_CONFIG },
    data: { logoUrl: `${RUTA_UPLOADS}/${nombre}` },
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
