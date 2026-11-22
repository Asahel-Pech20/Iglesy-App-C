import { http, HttpResponse } from 'msw';
import { ruta } from '../utils';
import { anunciosHandlers } from './anuncios';
import { asistenciaHandlers } from './asistencia';
import { authHandlers } from './auth';
import { configuracionHandlers } from './configuracion';
import { dashboardHandlers } from './dashboard';
import { diezmoHandlers } from './diezmo';
import { donacionesHandlers } from './donaciones';
import { iglesiasHandlers } from './iglesias';
import { eventosHandlers } from './eventos';
import { miembrosHandlers } from './miembros';
import { ministeriosHandlers } from './ministerios';
import { reportesHandlers } from './reportes';
import { usuariosHandlers } from './usuarios';

// Cada dueño agrega aquí los handlers de su módulo (F2: miembros/ministerios, F3: eventos…, F4: donaciones…)
export const handlers = [
  http.get(ruta('/health'), () => HttpResponse.json({ data: { status: 'ok' } })),
  ...authHandlers,
  ...usuariosHandlers,
  ...configuracionHandlers,
  ...miembrosHandlers,
  ...ministeriosHandlers,
  ...eventosHandlers,
  ...asistenciaHandlers,
  ...anunciosHandlers,
  ...donacionesHandlers,
  ...dashboardHandlers,
  ...reportesHandlers,
  ...diezmoHandlers,
  ...iglesiasHandlers,
];
