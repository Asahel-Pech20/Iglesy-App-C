import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import { usuarioDe } from '../../middlewares/auth';
import type { QueryUsuarios } from './usuarios.schemas';
import * as usuariosService from './usuarios.service';

type ConId = { id: string };

export const listar: RequestHandler = async (req, res) => {
  const { datos, meta } = await usuariosService.listar(
    req.query as unknown as QueryUsuarios,
    usuarioDe(req),
  );
  res.json(okLista(datos, meta));
};

export const opciones: RequestHandler = async (req, res) => {
  const { rol } = req.query as { rol?: QueryUsuarios['rol'] };
  res.json(ok(await usuariosService.opciones(usuarioDe(req), rol)));
};

export const obtener: RequestHandler<ConId> = async (req, res) => {
  res.json(ok(await usuariosService.obtener(req.params.id, usuarioDe(req))));
};

export const crear: RequestHandler = async (req, res) => {
  res.status(201).json(ok(await usuariosService.crear(req.body, usuarioDe(req))));
};

export const editar: RequestHandler<ConId> = async (req, res) => {
  res.json(ok(await usuariosService.editar(req.params.id, req.body, usuarioDe(req))));
};

export const cambiarEstado: RequestHandler<ConId> = async (req, res) => {
  const usuario = await usuariosService.cambiarEstado(
    req.params.id,
    req.body.activo,
    usuarioDe(req),
  );
  res.json(ok(usuario));
};

export const reenviarInvitacion: RequestHandler<ConId> = async (req, res) => {
  await usuariosService.reenviarInvitacion(req.params.id, usuarioDe(req));
  res.status(204).end();
};
