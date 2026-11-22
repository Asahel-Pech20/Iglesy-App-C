import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import { iglesiaAlcanceDe } from '../../middlewares/alcanceIglesia';
import type {
  CerrarIglesia,
  CrearIglesia,
  EditarIglesia,
  QueryListarIglesias,
} from './iglesias.schemas';
import * as service from './iglesias.service';

export const listar: RequestHandler = async (req, res) => {
  const { datos, meta } = await service.listar(req.query as unknown as QueryListarIglesias);
  res.json(okLista(datos, meta));
};

export const crear: RequestHandler = async (req, res) => {
  res.status(201).json(ok(await service.crear(req.body as CrearIglesia)));
};

export const obtener: RequestHandler = async (req, res) => {
  res.json(ok(await service.obtener(iglesiaAlcanceDe(req))));
};

export const editar: RequestHandler = async (req, res) => {
  res.json(ok(await service.editar(iglesiaAlcanceDe(req), req.body as EditarIglesia)));
};

export const cerrar: RequestHandler = async (req, res) => {
  res.json(ok(await service.cerrar(iglesiaAlcanceDe(req), req.body as CerrarIglesia)));
};
