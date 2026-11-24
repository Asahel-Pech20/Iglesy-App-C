import type { RequestHandler } from 'express';
import { AppError } from '../../lib/appError';
import { ok, okLista } from '../../lib/respuesta';
import { iglesiaAlcanceDe } from '../../middlewares/alcanceIglesia';
import type {
  CambiarEstadoObjeto,
  CrearObjeto,
  Criterios,
  EditarObjeto,
  QueryHistorialCriterios,
  QueryListarObjetos,
} from './patrimonio.schemas';
import * as service from './patrimonio.service';

const objetoId = (req: Parameters<RequestHandler>[0]) => req.params['objetoId'] as string;

export const listarObjetos: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.listarObjetos(
    iglesiaAlcanceDe(req),
    req.query as unknown as QueryListarObjetos,
  );
  res.json(okLista(datos, meta));
};

export const crearObjeto: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(ok(await service.crearObjeto(iglesiaAlcanceDe(req), req.body as CrearObjeto)));
};

export const editarObjeto: RequestHandler = async (req, res) => {
  res.json(
    ok(await service.editarObjeto(iglesiaAlcanceDe(req), objetoId(req), req.body as EditarObjeto)),
  );
};

export const cambiarEstadoObjeto: RequestHandler = async (req, res) => {
  res.json(
    ok(
      await service.cambiarEstadoObjeto(
        iglesiaAlcanceDe(req),
        objetoId(req),
        req.body as CambiarEstadoObjeto,
      ),
    ),
  );
};

export const indice: RequestHandler = async (req, res) => {
  res.json(ok(await service.indiceDeIglesia(iglesiaAlcanceDe(req))));
};

export const obtenerCriterios: RequestHandler = async (_req, res) => {
  res.json(ok(await service.obtenerCriterios()));
};

export const guardarCriterios: RequestHandler = async (req, res) => {
  if (!req.usuario) throw AppError.noAutenticado();
  res.json(ok(await service.guardarCriterios(req.body as Criterios, req.usuario.id)));
};

export const historialCriterios: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.historialCriterios(
    req.query as unknown as QueryHistorialCriterios,
  );
  res.json(okLista(datos, meta));
};
