import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import { usuarioDe } from '../../middlewares/auth';
import type {
  CuerpoMonto,
  QueryAgrupado,
  QueryListarDiezmos,
  QueryPeriodo,
} from './diezmo.schemas';
import * as service from './diezmo.service';

type ParamsMisa = { iglesiaId: string; misaId: string };
type ParamsIglesia = { iglesiaId: string };

export const capturar: RequestHandler<ParamsMisa> = async (req, res) => {
  const { iglesiaId, misaId } = req.params;
  const { monto } = req.body as CuerpoMonto;
  res.status(201).json(ok(await service.capturar(iglesiaId, misaId, monto, usuarioDe(req).id)));
};

export const obtener: RequestHandler<ParamsMisa> = async (req, res) => {
  res.json(ok(await service.obtener(req.params.iglesiaId, req.params.misaId)));
};

export const corregir: RequestHandler<ParamsMisa> = async (req, res) => {
  const { iglesiaId, misaId } = req.params;
  const { monto } = req.body as CuerpoMonto;
  res.json(ok(await service.corregir(iglesiaId, misaId, monto, usuarioDe(req).id)));
};

export const listar: RequestHandler<ParamsIglesia> = async (req, res) => {
  const { datos, meta } = await service.listar(
    req.params.iglesiaId,
    req.query as unknown as QueryListarDiezmos,
  );
  res.json(okLista(datos, meta));
};

export const resumen: RequestHandler<ParamsIglesia> = async (req, res) => {
  res.json(ok(await service.resumen(req.params.iglesiaId, req.query as unknown as QueryPeriodo)));
};

export const agrupado: RequestHandler<ParamsIglesia> = async (req, res) => {
  res.json(ok(await service.agrupado(req.params.iglesiaId, req.query as unknown as QueryAgrupado)));
};
