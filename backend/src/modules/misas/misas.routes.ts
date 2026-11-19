// Rutas bajo /iglesias/:iglesiaId (versión mínima de misas). Cada ruta declara autenticar,
// autorizar y alcanceIglesia: el personal solo entra a su propia iglesia (RNF-10).
import { Router } from 'express';
import { alcanceIglesia, iglesiaDeLaRuta } from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './misas.controller';
import {
  esquemaCrearMisa,
  esquemaCrearPadre,
  esquemaIglesia,
  esquemaListarMisas,
} from './misas.schemas';

export const misasRouter = Router({ mergeParams: true });

misasRouter.get(
  '/padres',
  autenticar,
  autorizar('misas:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia }),
  c.listarPadres,
);
misasRouter.post(
  '/padres',
  autenticar,
  autorizar('misas:registrar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, body: esquemaCrearPadre }),
  c.crearPadre,
);
misasRouter.get(
  '/misas-celebradas',
  autenticar,
  autorizar('misas:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, query: esquemaListarMisas }),
  c.listarMisas,
);
misasRouter.post(
  '/misas-celebradas',
  autenticar,
  autorizar('misas:registrar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, body: esquemaCrearMisa }),
  c.registrarMisa,
);
