import { Router } from 'express';
import multer from 'multer';
import { autenticar, autenticarOpcional, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './configuracion.controller';
import {
  esquemaConfiguracion,
  esquemaCrearHorario,
  esquemaEditarHorario,
  esquemaIdHorario,
} from './configuracion.schemas';
import { MAX_LOGO_BYTES } from './configuracion.service';

// En memoria: el service valida tipo y contenido antes de escribir en disco
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
});

const editar = [autenticar, autorizar('configuracion:editar')];

export const configuracionRouter = Router();

configuracionRouter.get('/', c.obtener);
configuracionRouter.put('/', ...editar, validar({ body: esquemaConfiguracion }), c.actualizar);
configuracionRouter.post('/logo', ...editar, subida.single('logo'), c.subirLogo);

configuracionRouter.get('/horarios', autenticarOpcional, c.listarHorarios);
configuracionRouter.post(
  '/horarios',
  ...editar,
  validar({ body: esquemaCrearHorario }),
  c.crearHorario,
);
configuracionRouter.patch(
  '/horarios/:id',
  ...editar,
  validar({ params: esquemaIdHorario, body: esquemaEditarHorario }),
  c.editarHorario,
);
configuracionRouter.delete(
  '/horarios/:id',
  ...editar,
  validar({ params: esquemaIdHorario }),
  c.eliminarHorario,
);
