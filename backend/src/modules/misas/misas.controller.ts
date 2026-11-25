import type { RequestHandler } from 'express';
import { ok, okLista } from '../../lib/respuesta';
import * as horario from './horario.service';
import type {
  ActualizarHorario,
  ActualizarPadre,
  CrearHorario,
  CrearMisa,
  CrearPadre,
  QueryBuscarPadres,
  QueryListarMisas,
} from './misas.schemas';
import * as service from './misas.service';
import * as padres from './padres.service';

type Iglesia = { iglesiaId: string };
type PadreDeIglesia = { iglesiaId: string; padreId: string };
type HorarioDeIglesia = { iglesiaId: string; horarioId: string };

// ───────────── Padres de una iglesia (E3-06) ─────────────

export const listarPadres: RequestHandler<Iglesia> = async (req, res) => {
  res.json(ok(await padres.listarPadresDeIglesia(req.params.iglesiaId)));
};

export const crearPadre: RequestHandler<Iglesia> = async (req, res) => {
  res
    .status(201)
    .json(ok(await padres.crearPadreEnIglesia(req.params.iglesiaId, req.body as CrearPadre)));
};

export const asociarPadre: RequestHandler<PadreDeIglesia> = async (req, res) => {
  res.json(ok(await padres.asociarPadre(req.params.iglesiaId, req.params.padreId)));
};

export const desasociarPadre: RequestHandler<PadreDeIglesia> = async (req, res) => {
  await padres.desasociarPadre(req.params.iglesiaId, req.params.padreId);
  res.status(204).end();
};

// ───────────── Padres a nivel nacional (E3-06, supuesto P-19) ─────────────

export const buscarPadres: RequestHandler = async (req, res) => {
  const { datos, meta } = await padres.buscarPadres(req.query as unknown as QueryBuscarPadres);
  res.json(okLista(datos, meta));
};

export const crearPadreNacional: RequestHandler = async (req, res) => {
  res.status(201).json(ok(await padres.crearPadre(req.body as CrearPadre)));
};

export const actualizarPadre: RequestHandler<{ padreId: string }> = async (req, res) => {
  res.json(ok(await padres.actualizarPadre(req.params.padreId, req.body as ActualizarPadre)));
};

// ───────────── Horario semanal (E3-07) ─────────────

export const listarHorario: RequestHandler<Iglesia> = async (req, res) => {
  res.json(ok(await horario.listarHorario(req.params.iglesiaId)));
};

export const crearMisaHorario: RequestHandler<Iglesia> = async (req, res) => {
  res
    .status(201)
    .json(ok(await horario.crearMisaHorario(req.params.iglesiaId, req.body as CrearHorario)));
};

export const actualizarMisaHorario: RequestHandler<HorarioDeIglesia> = async (req, res) => {
  res.json(
    ok(
      await horario.actualizarMisaHorario(
        req.params.iglesiaId,
        req.params.horarioId,
        req.body as ActualizarHorario,
      ),
    ),
  );
};

export const quitarMisaHorario: RequestHandler<HorarioDeIglesia> = async (req, res) => {
  await horario.quitarMisaHorario(req.params.iglesiaId, req.params.horarioId);
  res.status(204).end();
};

// ───────────── Misas celebradas (versión mínima del diezmo) ─────────────

export const listarMisas: RequestHandler<Iglesia> = async (req, res) => {
  const { datos, meta } = await service.listarMisas(
    req.params.iglesiaId,
    req.query as unknown as QueryListarMisas,
  );
  res.json(okLista(datos, meta));
};

export const registrarMisa: RequestHandler<Iglesia> = async (req, res) => {
  res
    .status(201)
    .json(ok(await service.registrarMisa(req.params.iglesiaId, req.body as CrearMisa)));
};
