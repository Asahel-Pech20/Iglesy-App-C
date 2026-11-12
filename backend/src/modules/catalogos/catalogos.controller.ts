import type { RequestHandler } from 'express';
import { ok } from '../../lib/respuesta';
import type { Importacion } from './catalogos.schemas';
import * as service from './catalogos.service';

export const estados: RequestHandler = async (_req, res) => {
  res.json(ok(await service.listarEstados()));
};

export const municipios: RequestHandler = async (req, res) => {
  res.json(ok(await service.municipiosDe(req.params['clave'] as string)));
};

export const localidades: RequestHandler = async (req, res) => {
  res.json(ok(await service.localidadesDe(req.params['clave'] as string)));
};

export const importar: RequestHandler = async (req, res) => {
  res.json(ok(await service.importar((req.body as Importacion).filas)));
};
