// Patrimonio (E2-08 y E2-10, Nataly). Los objetos van bajo /iglesias/:iglesiaId: el administrador
// solo entra a los de su iglesia y la Coordinación los consulta (RF-12, alcanceIglesia). En una
// iglesia cerrada solo se puede leer (alcanceIglesia responde 422 a las escrituras).
import { Router } from 'express';
import {
  SUPUESTOS_ALCANCE,
  alcanceIglesia,
  iglesiaDeLaRuta,
} from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './patrimonio.controller';
import {
  esquemaCambiarEstadoObjeto,
  esquemaCrearObjeto,
  esquemaCriterios,
  esquemaEditarObjeto,
  esquemaHistorialCriterios,
  esquemaIdIglesia,
  esquemaIdObjeto,
  esquemaListarObjetos,
} from './patrimonio.schemas';

const deEsaIglesia = alcanceIglesia(iglesiaDeLaRuta, {
  coordinacion: SUPUESTOS_ALCANCE.datosIglesia,
});

/** Se monta en /iglesias/:iglesiaId. */
export const objetosRouter = Router({ mergeParams: true });
objetosRouter.get(
  '/objetos',
  autenticar,
  autorizar('patrimonio:leer'),
  validar({ params: esquemaIdIglesia, query: esquemaListarObjetos }),
  deEsaIglesia,
  c.listarObjetos,
);
objetosRouter.post(
  '/objetos',
  autenticar,
  autorizar('patrimonio:gestionar'),
  validar({ params: esquemaIdIglesia, body: esquemaCrearObjeto }),
  deEsaIglesia,
  c.crearObjeto,
);
objetosRouter.patch(
  '/objetos/:objetoId',
  autenticar,
  autorizar('patrimonio:gestionar'),
  validar({ params: esquemaIdObjeto, body: esquemaEditarObjeto }),
  deEsaIglesia,
  c.editarObjeto,
);
objetosRouter.post(
  '/objetos/:objetoId/estado',
  autenticar,
  autorizar('patrimonio:gestionar'),
  validar({ params: esquemaIdObjeto, body: esquemaCambiarEstadoObjeto }),
  deEsaIglesia,
  c.cambiarEstadoObjeto,
);
objetosRouter.get(
  '/indice',
  autenticar,
  autorizar('patrimonio:leer'),
  validar({ params: esquemaIdIglesia }),
  deEsaIglesia,
  c.indice,
);

/** Se monta en /criterios-indice (RF-22): solo la Coordinación. */
export const criteriosRouter = Router();
criteriosRouter.get('/', autenticar, autorizar('criterios:leer'), c.obtenerCriterios);
criteriosRouter.put(
  '/',
  autenticar,
  autorizar('criterios:editar'),
  validar({ body: esquemaCriterios }),
  c.guardarCriterios,
);
criteriosRouter.get(
  '/historial',
  autenticar,
  autorizar('criterios:leer'),
  validar({ query: esquemaHistorialCriterios }),
  c.historialCriterios,
);
