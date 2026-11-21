// Rutas bajo /iglesias/:iglesiaId. Cada ruta declara autenticar, autorizar y alcanceIglesia:
// el personal solo entra al diezmo de su propia iglesia (RNF-09, RNF-10).
import { Router } from 'express';
import { alcanceIglesia, iglesiaDeLaRuta } from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './diezmo.controller';
import {
  esquemaAgrupado,
  esquemaIglesia,
  esquemaListarDiezmos,
  esquemaMisa,
  esquemaMonto,
  esquemaPeriodo,
} from './diezmo.schemas';

export const diezmoRouter = Router({ mergeParams: true });

diezmoRouter.post(
  '/misas-celebradas/:misaId/diezmo',
  autenticar,
  autorizar('diezmo:capturar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaMisa, body: esquemaMonto }),
  c.capturar,
);
diezmoRouter.get(
  '/misas-celebradas/:misaId/diezmo',
  autenticar,
  autorizar('diezmo:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaMisa }),
  c.obtener,
);
diezmoRouter.patch(
  '/misas-celebradas/:misaId/diezmo',
  autenticar,
  autorizar('diezmo:capturar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaMisa, body: esquemaMonto }),
  c.corregir,
);
diezmoRouter.get(
  '/diezmos',
  autenticar,
  autorizar('diezmo:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, query: esquemaListarDiezmos }),
  c.listar,
);
diezmoRouter.get(
  '/diezmo/resumen',
  autenticar,
  autorizar('diezmo:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, query: esquemaPeriodo }),
  c.resumen,
);
diezmoRouter.get(
  '/diezmo/agrupado',
  autenticar,
  autorizar('diezmo:leer'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, query: esquemaAgrupado }),
  c.agrupado,
);
