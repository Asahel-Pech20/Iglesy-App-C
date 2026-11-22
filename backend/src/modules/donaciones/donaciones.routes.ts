import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './donaciones.controller';
import {
  esquemaAnularDonacion,
  esquemaCrearDonacion,
  esquemaEditarDonacion,
  esquemaIdDonacion,
  esquemaListarDonaciones,
  esquemaResumen,
  esquemaResumenMensual,
} from './donaciones.schemas';

const porId = validar({ params: esquemaIdDonacion });
// Información financiera: solo ADMIN_IGLESIA, TESORERO y PASTOR (lectura) — specs.md §3, RF-06.5
const leer = autorizar('donaciones:leer');

export const donacionesRouter = Router();

donacionesRouter.get('/', autenticar, leer, validar({ query: esquemaListarDonaciones }), c.listar);
donacionesRouter.get('/resumen', autenticar, leer, validar({ query: esquemaResumen }), c.resumen);
donacionesRouter.get(
  '/resumen-mensual',
  autenticar,
  leer,
  validar({ query: esquemaResumenMensual }),
  c.resumenMensual,
);
donacionesRouter.post(
  '/',
  autenticar,
  autorizar('donaciones:crear'),
  validar({ body: esquemaCrearDonacion }),
  c.crear,
);
donacionesRouter.get('/:id', autenticar, leer, porId, c.obtener);
donacionesRouter.patch(
  '/:id',
  autenticar,
  autorizar('donaciones:editar'),
  porId,
  validar({ body: esquemaEditarDonacion }),
  c.editar,
);
donacionesRouter.patch(
  '/:id/anular',
  autenticar,
  autorizar('donaciones:eliminar'),
  porId,
  validar({ body: esquemaAnularDonacion }),
  c.anular,
);
