import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import type { Importacion, QueryCatalogo } from './catalogos.schemas';
import * as service from './catalogos.service';

const consulta = (req: Parameters<RequestHandler>[0]) => req.query as unknown as QueryCatalogo;

export const estados: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.listarEstados(consulta(req));
  res.json(okLista(datos, meta));
};

export const municipios: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.municipiosDe(req.params['clave'] as string, consulta(req));
  res.json(okLista(datos, meta));
};

export const localidades: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.localidadesDe(req.params['clave'] as string, consulta(req));
  res.json(okLista(datos, meta));
};

export const importar: RequestHandler = async (req, res) => {
  res.json(ok(await service.importar((req.body as Importacion).filas)));
};
