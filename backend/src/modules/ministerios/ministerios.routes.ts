import { Router } from 'express';
import { autenticar, autorizar, autorizarAlguno } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './ministerios.controller';
import {
  esquemaCoordinadores,
  esquemaCrearMinisterio,
  esquemaEditarMinisterio,
  esquemaEstadoMinisterio,
  esquemaIdMinisterio,
  esquemaIdVinculo,
  esquemaListarIntegrantes,
  esquemaListarMinisterios,
  esquemaVincularMiembros,
} from './ministerios.schemas';

const porId = validar({ params: esquemaIdMinisterio });
// Integrantes: ADMIN_IGLESIA/PASTOR (editar) o COORDINADOR de ese ministerio (editar-propio, se verifica en el service)
const gestionaIntegrantes = autorizarAlguno('ministerios:editar', 'ministerios:editar-propio');

export const ministeriosRouter = Router();

ministeriosRouter.get(
  '/',
  autenticar,
  autorizar('ministerios:leer'),
  validar({ query: esquemaListarMinisterios }),
  c.listar,
);
ministeriosRouter.post(
  '/',
  autenticar,
  autorizar('ministerios:crear'),
  validar({ body: esquemaCrearMinisterio }),
  c.crear,
);
ministeriosRouter.get('/:id', autenticar, autorizar('ministerios:leer'), porId, c.obtener);
ministeriosRouter.patch(
  '/:id',
  autenticar,
  autorizar('ministerios:editar'),
  porId,
  validar({ body: esquemaEditarMinisterio }),
  c.editar,
);
ministeriosRouter.patch(
  '/:id/estado',
  autenticar,
  autorizar('ministerios:eliminar'),
  porId,
  validar({ body: esquemaEstadoMinisterio }),
  c.cambiarEstado,
);
ministeriosRouter.put(
  '/:id/coordinadores',
  autenticar,
  autorizar('ministerios:editar'),
  porId,
  validar({ body: esquemaCoordinadores }),
  c.asignarCoordinadores,
);
ministeriosRouter.get(
  '/:id/miembros',
  autenticar,
  autorizar('ministerios:leer'),
  porId,
  validar({ query: esquemaListarIntegrantes }),
  c.listarIntegrantes,
);
ministeriosRouter.post(
  '/:id/miembros',
  autenticar,
  gestionaIntegrantes,
  porId,
  validar({ body: esquemaVincularMiembros }),
  c.vincularMiembros,
);
ministeriosRouter.delete(
  '/:id/miembros/:miembroId',
  autenticar,
  gestionaIntegrantes,
  validar({ params: esquemaIdVinculo }),
  c.desvincularMiembro,
);
