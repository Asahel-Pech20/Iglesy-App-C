// Iglesias del sistema nacional (ADR-0004). La Coordinación las lista, crea y cierra; el administrador
// de una iglesia ve y edita solo la suya (alcanceIglesia, RF-08, RNF-10).
import { Router } from 'express';
import { autenticar, autorizar, autorizarAlguno } from '../../middlewares/auth';
import {
  SUPUESTOS_ALCANCE,
  alcanceIglesia,
  iglesiaDeLaRuta,
} from '../../middlewares/alcanceIglesia';
import { validar } from '../../middlewares/validar';
import * as c from './iglesias.controller';
import {
  esquemaCerrarIglesia,
  esquemaCrearIglesia,
  esquemaEditarIglesia,
  esquemaIdIglesia,
  esquemaListarIglesias,
} from './iglesias.schemas';

export const iglesiasRouter = Router();

// La Coordinación entra a los datos de cualquier iglesia (supuesto S-02); el personal, solo a la suya
const deEsaIglesia = alcanceIglesia(iglesiaDeLaRuta, {
  coordinacion: SUPUESTOS_ALCANCE.datosIglesia,
});

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
iglesiasRouter.get(
  '/:iglesiaId',
  autenticar,
  autorizarAlguno('iglesias:leer', 'iglesias:editar'),
  validar({ params: esquemaIdIglesia }),
  deEsaIglesia,
  c.obtener,
);
iglesiasRouter.patch(
  '/:iglesiaId',
  autenticar,
  autorizar('iglesias:editar'),
  validar({ params: esquemaIdIglesia, body: esquemaEditarIglesia }),
  deEsaIglesia,
  c.editar,
);
iglesiasRouter.post(
  '/:iglesiaId/cierre',
  autenticar,
  autorizar('iglesias:cerrar'),
  validar({ params: esquemaIdIglesia, body: esquemaCerrarIglesia }),
  deEsaIglesia,
  c.cerrar,
);
