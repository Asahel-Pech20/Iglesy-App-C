import type { RequestHandler } from 'express';
import { contextoActual } from '../../lib/contextoIglesia';
import { ok } from '../../lib/respuesta';
import * as configuracionService from './configuracion.service';

type ConId = { id: string };

export const obtener: RequestHandler = async (_req, res) => {
  res.json(ok(await configuracionService.obtener()));
};

export const actualizar: RequestHandler = async (req, res) => {
  res.json(ok(await configuracionService.actualizar(req.body)));
};

export const subirLogo: RequestHandler = async (req, res) => {
  res.json(ok(await configuracionService.guardarLogo(req.file)));
};

/**
 * Ruta pública con sesión opcional (E1-06): el personal ve los horarios de SU iglesia; sin sesión
 * (o la Coordinación), los de la iglesia inicial hasta E1-06b.
 */
export const listarHorarios: RequestHandler = async (_req, res) => {
  const horarios =
    contextoActual()?.tipo === 'iglesia'
      ? await configuracionService.listarHorarios()
      : await configuracionService.enIglesiaInicial(configuracionService.listarHorarios, []);
  res.json(ok(horarios));
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
