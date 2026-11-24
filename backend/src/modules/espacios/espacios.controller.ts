import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import type {
  CrearSolicitud,
  CrearTipo,
  CuerpoCotizar,
  EditarTipo,
  QueryListarSolicitudes,
} from './espacios.schemas';
import * as service from './espacios.service';

type ParamsIglesia = { iglesiaId: string };
type ParamsRecurso = { iglesiaId: string; id: string };
type ParamsFolio = { folio: string };

// El «ahora» se toma aquí y viaja al service: así las pruebas del dominio no leen el reloj.
const ahora = () => new Date();

// ───────── Panel ─────────

export const listarTipos: RequestHandler<ParamsIglesia> = async (req, res) => {
  res.json(ok(await service.listarTipos(req.params.iglesiaId)));
};

export const crearTipo: RequestHandler<ParamsIglesia> = async (req, res) => {
  res.status(201).json(ok(await service.crearTipo(req.params.iglesiaId, req.body as CrearTipo)));
};

export const editarTipo: RequestHandler<ParamsRecurso> = async (req, res) => {
  const { iglesiaId, id } = req.params;
  res.json(ok(await service.editarTipo(iglesiaId, id, req.body as EditarTipo)));
};

export const listarSolicitudes: RequestHandler<ParamsIglesia> = async (req, res) => {
  const { datos, meta } = await service.listarSolicitudes(
    req.params.iglesiaId,
    req.query as unknown as QueryListarSolicitudes,
    ahora(),
  );
  res.json(okLista(datos, meta));
};

export const obtenerSolicitud: RequestHandler<ParamsRecurso> = async (req, res) => {
  const { iglesiaId, id } = req.params;
  res.json(ok(await service.obtenerSolicitud(iglesiaId, id, ahora())));
};

export const cotizar: RequestHandler<ParamsRecurso> = async (req, res) => {
  const { iglesiaId, id } = req.params;
  res
    .status(201)
    .json(ok(await service.cotizar(iglesiaId, id, req.body as CuerpoCotizar, ahora())));
};

export const marcarSinLugar: RequestHandler<ParamsRecurso> = async (req, res) => {
  const { iglesiaId, id } = req.params;
  res.json(ok(await service.marcarSinLugar(iglesiaId, id, ahora())));
};

// ───────── Público ─────────

export const tiposPublicos: RequestHandler<ParamsIglesia> = async (req, res) => {
  res.json(ok(await service.tiposPublicos(req.params.iglesiaId)));
};

export const crearSolicitud: RequestHandler<ParamsIglesia> = async (req, res) => {
  res
    .status(201)
    .json(
      ok(await service.crearSolicitud(req.params.iglesiaId, req.body as CrearSolicitud, ahora())),
    );
};

export const consultar: RequestHandler<ParamsFolio> = async (req, res) => {
  const { clave } = req.body as { clave: string };
  res.json(ok(await service.consultar(req.params.folio, clave, ahora())));
};

export const responder =
  (accion: 'ACEPTAR' | 'RECHAZAR' | 'CANCELAR'): RequestHandler<ParamsFolio> =>
  async (req, res) => {
    const { clave } = req.body as { clave: string };
    res.json(ok(await service.responder(req.params.folio, clave, accion, ahora())));
  };
