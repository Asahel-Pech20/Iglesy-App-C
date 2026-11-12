// Catálogo del INEGI (E2-05). Consulta pública sin sesión; carga solo la Coordinación (RF-10).
import { Router } from 'express';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './catalogos.controller';
import { esquemaClaveEstado, esquemaClaveMunicipio, esquemaImportacion } from './catalogos.schemas';

/** Se monta en /public: catálogo para elegir el lugar (RF-01, RF-02, RF-09). */
export const catalogosPublicoRouter = Router();
catalogosPublicoRouter.get('/estados', c.estados);
catalogosPublicoRouter.get(
  '/estados/:clave/municipios',
  validar({ params: esquemaClaveEstado }),
  c.municipios,
);
catalogosPublicoRouter.get(
  '/municipios/:clave/localidades',
  validar({ params: esquemaClaveMunicipio }),
  c.localidades,
);

/** Se monta en /catalogos. */
export const catalogosRouter = Router();
catalogosRouter.post(
  '/importacion',
  autenticar,
  autorizar('catalogos:gestionar'),
  validar({ body: esquemaImportacion }),
  c.importar,
);
