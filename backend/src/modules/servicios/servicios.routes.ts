// Servicios y pláticas (E3-11 a E3-14, Genaro). Bajo /iglesias/:iglesiaId, el administrador de la
// iglesia los gestiona (servicios:gestionar, alcanceIglesia: RN-32). El público ve servicios y
// pláticas en la ficha (E2-11) y consulta las pláticas por tipo sin cuenta (RF-39, RN-33).
import { Router } from 'express';
import { alcanceIglesia, iglesiaDeLaRuta } from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './servicios.controller';
import {
  esquemaActualizarPlatica,
  esquemaActualizarServicio,
  esquemaCrearPlatica,
  esquemaCrearServicio,
  esquemaIglesia,
  esquemaPlaticaDeIglesia,
  esquemaPlaticasDelMunicipio,
  esquemaPlaticasPublicas,
  esquemaServicioDeIglesia,
} from './servicios.schemas';

export const serviciosRouter = Router({ mergeParams: true });

// ───────────── Servicios (E3-11: RF-30–RF-34) ─────────────

serviciosRouter.get(
  '/servicios',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia }),
  c.listarServicios,
);
serviciosRouter.post(
  '/servicios',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, body: esquemaCrearServicio }),
  c.crearServicio,
);
serviciosRouter.patch(
  '/servicios/:servicioId',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaServicioDeIglesia, body: esquemaActualizarServicio }),
  c.actualizarServicio,
);
serviciosRouter.delete(
  '/servicios/:servicioId',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaServicioDeIglesia }),
  c.quitarServicio,
);

// ───────────── Pláticas (E3-13: RF-36, RF-37) ─────────────

serviciosRouter.get(
  '/platicas',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia }),
  c.listarPlaticas,
);
serviciosRouter.post(
  '/platicas',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaIglesia, body: esquemaCrearPlatica }),
  c.crearPlatica,
);
serviciosRouter.patch(
  '/platicas/:platicaId',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaPlaticaDeIglesia, body: esquemaActualizarPlatica }),
  c.actualizarPlatica,
);
serviciosRouter.delete(
  '/platicas/:platicaId',
  autenticar,
  autorizar('servicios:gestionar'),
  alcanceIglesia(iglesiaDeLaRuta),
  validar({ params: esquemaPlaticaDeIglesia }),
  c.quitarPlatica,
);

// ───────────── Sin sesión (E3-14: RF-39, RN-33) ─────────────

// «¿Cuándo son las pláticas de bautizo?»: ?tipo=PREBAUTISMAL
export const serviciosPublicoRouter = Router();

serviciosPublicoRouter.get(
  '/iglesias/:iglesiaId/platicas',
  validar({ params: esquemaIglesia, query: esquemaPlaticasPublicas }),
  c.platicasPublicas,
);

// RF-83 (deseable, supuesto P-29): ?tipo=PREBAUTISMAL&municipio=31050
serviciosPublicoRouter.get(
  '/platicas',
  validar({ query: esquemaPlaticasDelMunicipio }),
  c.platicasDelMunicipio,
);
