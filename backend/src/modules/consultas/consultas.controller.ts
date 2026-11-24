import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import type {
  QueryBusquedaPatrimonio,
  QueryListaPublica,
  QueryReconocidas,
} from './consultas.schemas';
import * as service from './consultas.service';

export const listaPorEstado: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.listaPorEstado(req.query as unknown as QueryListaPublica);
  res.json(okLista(datos, meta));
};

export const ficha: RequestHandler = async (req, res) => {
  res.json(ok(await service.ficha(req.params['iglesiaId'] as string)));
};

export const reconocidas: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.reconocidas(req.query as unknown as QueryReconocidas);
  res.json(okLista(datos, meta));
};

export const busquedaPatrimonio: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.busquedaPatrimonio(
    req.query as unknown as QueryBusquedaPatrimonio,
  );
  res.json(okLista(datos, meta));
};
