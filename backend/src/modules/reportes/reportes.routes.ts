import { Router } from 'express';
import { autenticar, autorizar, autorizarAlguno } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './reportes.controller';
import {
  esquemaReporteAsistencia,
  esquemaReporteIngresos,
  esquemaReporteMiembros,
  esquemaReporteMinisterios,
} from './reportes.schemas';

// Miembros / asistencia / ministerios: ADMIN_IGLESIA, PASTOR, SECRETARIO; COORDINADOR solo sus ministerios
const generales = autorizarAlguno('reportes:generales', 'reportes:generales-propio');

export const reportesRouter = Router();

reportesRouter.get(
  '/miembros',
  autenticar,
  generales,
  validar({ query: esquemaReporteMiembros }),
  c.miembros,
);
reportesRouter.get(
  '/asistencia',
  autenticar,
  generales,
  validar({ query: esquemaReporteAsistencia }),
  c.asistencia,
);
reportesRouter.get(
  '/ministerios',
  autenticar,
  generales,
  validar({ query: esquemaReporteMinisterios }),
  c.ministerios,
);
// Información financiera: ADMIN_IGLESIA, PASTOR y TESORERO (RF-06.5)
reportesRouter.get(
  '/ingresos',
  autenticar,
  autorizar('reportes:ingresos'),
  validar({ query: esquemaReporteIngresos }),
  c.ingresos,
);
