// Consultas públicas de iglesias (sin sesión). Se monta en /public.
import { Router } from 'express';
import { validar } from '../../middlewares/validar';
import * as c from './consultas.controller';
import {
  esquemaBusquedaPatrimonio,
  esquemaIdPublico,
  esquemaListaPublica,
  esquemaReconocidas,
} from './consultas.schemas';

export const consultasPublicasRouter = Router();
// E2-07 (RF-01–RF-05, CA-02, CA-03)
consultasPublicasRouter.get('/iglesias', validar({ query: esquemaListaPublica }), c.listaPorEstado);
// E2-11 (RF-06, RF-16, RF-18, CA-04)
consultasPublicasRouter.get('/iglesias/:iglesiaId', validar({ params: esquemaIdPublico }), c.ficha);
// E2-12 (RF-19–RF-21, CA-06)
consultasPublicasRouter.get('/reconocidas', validar({ query: esquemaReconocidas }), c.reconocidas);
// E2-13 (RF-23, CA-08)
consultasPublicasRouter.get(
  '/busqueda-patrimonio',
  validar({ query: esquemaBusquedaPatrimonio }),
  c.busquedaPatrimonio,
);
