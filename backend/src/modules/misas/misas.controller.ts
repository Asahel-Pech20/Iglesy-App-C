import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import type { CrearMisa, CrearPadre, QueryListarMisas } from './misas.schemas';
import * as service from './misas.service';

export const listarPadres: RequestHandler = async (_req, res) => {
  res.json(ok(await service.listarPadres()));
};

export const crearPadre: RequestHandler<{ iglesiaId: string }> = async (req, res) => {
  res.status(201).json(ok(await service.crearPadre(req.body as CrearPadre)));
};

export const listarMisas: RequestHandler<{ iglesiaId: string }> = async (req, res) => {
  const { datos, meta } = await service.listarMisas(
    req.params.iglesiaId,
    req.query as unknown as QueryListarMisas,
  );
  res.json(okLista(datos, meta));
};

export const registrarMisa: RequestHandler<{ iglesiaId: string }> = async (req, res) => {
  res
    .status(201)
    .json(ok(await service.registrarMisa(req.params.iglesiaId, req.body as CrearMisa)));
};
