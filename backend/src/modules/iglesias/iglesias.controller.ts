import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import type { CrearIglesia, QueryListarIglesias } from './iglesias.schemas';
import * as service from './iglesias.service';

export const listar: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.listar(req.query as unknown as QueryListarIglesias);
  res.json(okLista(datos, meta));
};

export const crear: RequestHandler = async (req, res) => {
  res.status(201).json(ok(await service.crear(req.body as CrearIglesia)));
};
