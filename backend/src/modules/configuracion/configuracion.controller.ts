import type { Request, RequestHandler } from 'express';
import { AppError } from '../../lib/appError';
import { contextoActual } from '../../lib/contextoIglesia';
import { ok } from '../../lib/respuesta';
import * as configuracionService from './configuracion.service';

type ConId = { id: string };

/**
 * Iglesia de una lectura pública con sesión opcional (E1-06b, ajuste 3 del orquestador):
 * - personal de una iglesia → SU iglesia (ignora ?iglesiaId);
 * - Coordinación → exige ?iglesiaId=; nunca recibe la iglesia inicial en silencio;
 * - sin sesión → ?iglesiaId= si viene; si no, la iglesia inicial, elegida de forma explícita.
 */
async function enIglesiaDeLaLectura<T>(
  req: Request,
  fn: () => Promise<T>,
  sinIglesias: T,
): Promise<T> {
  const { iglesiaId } = req.query as { iglesiaId?: string };
  const contexto = contextoActual();
  if (contexto?.tipo === 'iglesia') return fn();
  if (contexto?.tipo === 'nacional' && !iglesiaId) {
    const mensaje = 'La Coordinación debe indicar la iglesia (?iglesiaId=).';
    throw AppError.validacion(mensaje, [{ campo: 'iglesiaId', mensaje }]);
  }
  if (iglesiaId) return configuracionService.enIglesia(iglesiaId, fn);
  return configuracionService.enIglesiaInicial(fn, sinIglesias);
}

export const obtener: RequestHandler = async (req, res) => {
  res.json(
    ok(
      await enIglesiaDeLaLectura(
        req,
        configuracionService.obtener,
        configuracionService.CONFIGURACION_SIN_IGLESIAS,
      ),
    ),
  );
};

export const actualizar: RequestHandler = async (req, res) => {
  res.json(ok(await configuracionService.actualizar(req.body)));
};

export const subirLogo: RequestHandler = async (req, res) => {
  res.json(ok(await configuracionService.guardarLogo(req.file)));
};

export const listarHorarios: RequestHandler = async (req, res) => {
  res.json(ok(await enIglesiaDeLaLectura(req, configuracionService.listarHorarios, [])));
};

export const crearHorario: RequestHandler = async (req, res) => {
  res.status(201).json(ok(await configuracionService.crearHorario(req.body)));
};

export const editarHorario: RequestHandler<ConId> = async (req, res) => {
  res.json(ok(await configuracionService.editarHorario(req.params.id, req.body)));
};

export const eliminarHorario: RequestHandler<ConId> = async (req, res) => {
  await configuracionService.eliminarHorario(req.params.id);
  res.status(204).end();
};
