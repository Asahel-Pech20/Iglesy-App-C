import type { RequestHandler } from 'express';
import { ok } from '../../lib/respuesta';
import type {
  ActualizarPlatica,
  ActualizarServicio,
  CrearPlatica,
  CrearServicio,
  QueryPlaticasPublicas,
} from './servicios.schemas';
import * as service from './servicios.service';

type Iglesia = { iglesiaId: string };
type ServicioDeIglesia = { iglesiaId: string; servicioId: string };
type PlaticaDeIglesia = { iglesiaId: string; platicaId: string };

// ───────────── Servicios (E3-11) ─────────────

export const listarServicios: RequestHandler<Iglesia> = async (req, res) => {
  res.json(ok(await service.listarServicios(req.params.iglesiaId)));
};

export const crearServicio: RequestHandler<Iglesia> = async (req, res) => {
  res
    .status(201)
    .json(ok(await service.crearServicio(req.params.iglesiaId, req.body as CrearServicio)));
};

export const actualizarServicio: RequestHandler<ServicioDeIglesia> = async (req, res) => {
  res.json(
    ok(
      await service.actualizarServicio(
        req.params.iglesiaId,
        req.params.servicioId,
        req.body as ActualizarServicio,
      ),
    ),
  );
};

export const quitarServicio: RequestHandler<ServicioDeIglesia> = async (req, res) => {
  await service.quitarServicio(req.params.iglesiaId, req.params.servicioId);
  res.status(204).end();
};

// ───────────── Pláticas (E3-13) ─────────────

export const listarPlaticas: RequestHandler<Iglesia> = async (req, res) => {
  res.json(ok(await service.listarPlaticas(req.params.iglesiaId)));
};

export const crearPlatica: RequestHandler<Iglesia> = async (req, res) => {
  res
    .status(201)
    .json(ok(await service.crearPlatica(req.params.iglesiaId, req.body as CrearPlatica)));
};

export const actualizarPlatica: RequestHandler<PlaticaDeIglesia> = async (req, res) => {
  res.json(
    ok(
      await service.actualizarPlatica(
        req.params.iglesiaId,
        req.params.platicaId,
        req.body as ActualizarPlatica,
      ),
    ),
  );
};

export const quitarPlatica: RequestHandler<PlaticaDeIglesia> = async (req, res) => {
  await service.quitarPlatica(req.params.iglesiaId, req.params.platicaId);
  res.status(204).end();
};

// ───────────── Público (E3-14) ─────────────

export const platicasPublicas: RequestHandler<Iglesia> = async (req, res) => {
  res.json(
    ok(
      await service.platicasDeIglesiaPublica(
        req.params.iglesiaId,
        req.query as unknown as QueryPlaticasPublicas,
      ),
    ),
  );
};
