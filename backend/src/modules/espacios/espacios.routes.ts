// Rutas del panel, bajo /iglesias/:iglesiaId. Cada ruta declara autenticar, autorizar y
// alcanceIglesia: las solicitudes traen datos de contacto privados, que solo ve el personal de
// esa iglesia (RN-53, RN-54). La Coordinación no entra (SUPUESTOS_ALCANCE.datosPrivados).
import { Router } from 'express';
import {
  SUPUESTOS_ALCANCE,
  alcanceIglesia,
  iglesiaDeLaRuta,
} from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './espacios.controller';
import {
  esquemaCotizar,
  esquemaCrearTipo,
  esquemaEditarTipo,
  esquemaIglesia,
  esquemaListarSolicitudes,
  esquemaSolicitud,
  esquemaTipo,
} from './espacios.schemas';

export const espaciosRouter = Router({ mergeParams: true });

const alcance = alcanceIglesia(iglesiaDeLaRuta, { coordinacion: SUPUESTOS_ALCANCE.datosPrivados });

espaciosRouter.get(
  '/tipos-espacio',
  autenticar,
  autorizar('espacios:leer'),
  alcance,
  validar({ params: esquemaIglesia }),
  c.listarTipos,
);
espaciosRouter.post(
  '/tipos-espacio',
  autenticar,
  autorizar('espacios:gestionar'),
  alcance,
  validar({ params: esquemaIglesia, body: esquemaCrearTipo }),
  c.crearTipo,
);
espaciosRouter.patch(
  '/tipos-espacio/:id',
  autenticar,
  autorizar('espacios:gestionar'),
  alcance,
  validar({ params: esquemaTipo, body: esquemaEditarTipo }),
  c.editarTipo,
);
espaciosRouter.get(
  '/solicitudes-espacio',
  autenticar,
  autorizar('espacios:leer'),
  alcance,
  validar({ params: esquemaIglesia, query: esquemaListarSolicitudes }),
  c.listarSolicitudes,
);
espaciosRouter.get(
  '/solicitudes-espacio/:id',
  autenticar,
  autorizar('espacios:leer'),
  alcance,
  validar({ params: esquemaSolicitud }),
  c.obtenerSolicitud,
);
espaciosRouter.post(
  '/solicitudes-espacio/:id/cotizacion',
  autenticar,
  autorizar('espacios:gestionar'),
  alcance,
  validar({ params: esquemaSolicitud, body: esquemaCotizar }),
  c.cotizar,
);
espaciosRouter.post(
  '/solicitudes-espacio/:id/sin-lugar',
  autenticar,
  autorizar('espacios:gestionar'),
  alcance,
  validar({ params: esquemaSolicitud }),
  c.marcarSinLugar,
);
