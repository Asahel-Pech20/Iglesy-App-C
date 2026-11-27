// Rutas de misas. Bajo /iglesias/:iglesiaId: padres de la iglesia, horario semanal y misas
// celebradas; cada ruta declara autenticar, autorizar y alcanceIglesia (RNF-10, RN-32).
// Bajo /padres: los padres de todo el país (supuesto P-19).
import { Router } from 'express';
import {
  alcanceIglesia,
  iglesiaDeLaRuta,
  SUPUESTOS_ALCANCE,
} from '../../middlewares/alcanceIglesia';
import { autenticar, autorizar, autorizarAlguno } from '../../middlewares/auth';
import { validar } from '../../middlewares/validar';
import * as c from './misas.controller';
import {
  esquemaActualizarHorario,
  esquemaAgenda,
  esquemaArmarSemana,
  esquemaActualizarPadre,
  esquemaBuscarPadres,
  esquemaCrearHorario,
  esquemaCrearMisa,
  esquemaCrearPadre,
  esquemaHorarioDeIglesia,
  esquemaIdPadre,
  esquemaIglesia,
  esquemaListarMisas,
  esquemaPadreDeIglesia,
} from './misas.schemas';

export const misasRouter = Router({ mergeParams: true });

// La Coordinación (padres:gestionar) consulta padres y horario de cualquier iglesia; no los
// modifica ni ve las misas celebradas, que van con el diezmo (RNF-08)
const alcanceLectura = alcanceIglesia(iglesiaDeLaRuta, {
  coordinacion: SUPUESTOS_ALCANCE.datosIglesia,
});
const alcance = alcanceIglesia(iglesiaDeLaRuta);

// ───────────── Padres de la iglesia (E3-06: RF-40, RF-41) ─────────────

misasRouter.get(
  '/padres',
  autenticar,
  autorizarAlguno('misas:leer', 'padres:gestionar'),
  alcanceLectura,
  validar({ params: esquemaIglesia }),
  c.listarPadres,
);
// Crea un padre nuevo y lo asocia; el diezmo lo usa para registrar misas (misas:registrar)
misasRouter.post(
  '/padres',
  autenticar,
  autorizarAlguno('misas:programar', 'misas:registrar'),
  alcance,
  validar({ params: esquemaIglesia, body: esquemaCrearPadre }),
  c.crearPadre,
);
misasRouter.put(
  '/padres/:padreId',
  autenticar,
  autorizar('misas:programar'),
  alcance,
  validar({ params: esquemaPadreDeIglesia }),
  c.asociarPadre,
);
misasRouter.delete(
  '/padres/:padreId',
  autenticar,
  autorizar('misas:programar'),
  alcance,
  validar({ params: esquemaPadreDeIglesia }),
  c.desasociarPadre,
);

// ───────────── Horario semanal (E3-07: RF-42, RF-43, RF-45, RF-46) ─────────────

misasRouter.get(
  '/horario-misas',
  autenticar,
  autorizarAlguno('misas:leer', 'padres:gestionar'),
  alcanceLectura,
  validar({ params: esquemaIglesia }),
  c.listarHorario,
);
misasRouter.post(
  '/horario-misas',
  autenticar,
  autorizar('misas:programar'),
  alcance,
  validar({ params: esquemaIglesia, body: esquemaCrearHorario }),
  c.crearMisaHorario,
);
misasRouter.patch(
  '/horario-misas/:horarioId',
  autenticar,
  autorizar('misas:programar'),
  alcance,
  validar({ params: esquemaHorarioDeIglesia, body: esquemaActualizarHorario }),
  c.actualizarMisaHorario,
);
misasRouter.delete(
  '/horario-misas/:horarioId',
  autenticar,
  autorizar('misas:programar'),
  alcance,
  validar({ params: esquemaHorarioDeIglesia }),
  c.quitarMisaHorario,
);

// ───────────── Semana armada desde el horario (RF-84, supuesto P-29) ─────────────

misasRouter.get(
  '/semana-misas',
  autenticar,
  autorizar('misas:leer'),
  alcance,
  validar({ params: esquemaIglesia, query: esquemaAgenda }),
  c.semanaDeMisas,
);
misasRouter.post(
  '/misas-celebradas/semana',
  autenticar,
  autorizar('misas:registrar'),
  alcance,
  validar({ params: esquemaIglesia, body: esquemaArmarSemana }),
  c.armarSemana,
);

// ───────────── Misas celebradas (versión mínima del diezmo) ─────────────

misasRouter.get(
  '/misas-celebradas',
  autenticar,
  autorizar('misas:leer'),
  alcance,
  validar({ params: esquemaIglesia, query: esquemaListarMisas }),
  c.listarMisas,
);
misasRouter.post(
  '/misas-celebradas',
  autenticar,
  autorizar('misas:registrar'),
  alcance,
  validar({ params: esquemaIglesia, body: esquemaCrearMisa }),
  c.registrarMisa,
);

// ───────────── Padres de todo el país (E3-06, supuesto P-19) ─────────────

export const padresRouter = Router();

// Las iglesias también buscan aquí a un padre que ya existe antes de crearlo
padresRouter.get(
  '/',
  autenticar,
  autorizarAlguno('padres:gestionar', 'misas:programar'),
  validar({ query: esquemaBuscarPadres }),
  c.buscarPadres,
);
padresRouter.post(
  '/',
  autenticar,
  autorizar('padres:gestionar'),
  validar({ body: esquemaCrearPadre }),
  c.crearPadreNacional,
);
// E3-08 (RF-47, supuesto P-18): la Coordinación y el personal de las iglesias del padre
padresRouter.get(
  '/:padreId/agenda',
  autenticar,
  autorizarAlguno('padres:gestionar', 'misas:leer'),
  validar({ params: esquemaIdPadre, query: esquemaAgenda }),
  c.agendaDelPadre,
);
padresRouter.patch(
  '/:padreId',
  autenticar,
  autorizar('padres:gestionar'),
  validar({ params: esquemaIdPadre, body: esquemaActualizarPadre }),
  c.actualizarPadre,
);
