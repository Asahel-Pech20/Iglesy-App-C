// Iglesias del sistema nacional: solo la Coordinación las lista y las crea (ADR-0004).
import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './iglesias.controller';
import { esquemaCrearIglesia, esquemaListarIglesias } from './iglesias.schemas';

export const iglesiasRouter = Router();

iglesiasRouter.get(
  '/',
  autenticar,
  autorizar('iglesias:leer'),
  validar({ query: esquemaListarIglesias }),
  c.listar,
);
iglesiasRouter.post(
  '/',
  autenticar,
  autorizar('iglesias:crear'),
  validar({ body: esquemaCrearIglesia }),
  c.crear,
);
