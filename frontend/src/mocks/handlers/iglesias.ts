import { http, HttpResponse } from 'msw';
import type { DetalleError } from '@/app/tipos/comunes';
import type { CrearIglesia, Iglesia, TipoIglesia } from '@/app/tipos/iglesias';
import { db } from '../db';
import { ahora, autenticar, errorApi, paginarMock, ruta } from '../utils';

// Simulación de backend/src/modules/iglesias (versión mínima): solo la Coordinación lista y crea.

const TIPOS: TipoIglesia[] = [
  'CATEDRAL',
  'BASILICA',
  'PARROQUIA',
  'TEMPLO',
  'CAPILLA',
  'SANTUARIO',
];

const zonaValida = (zona: string) => {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

export const iglesiasHandlers = [
  http.get(ruta('/iglesias'), ({ request }) => {
    const usuario = autenticar(request, 'iglesias:leer');
    if (usuario instanceof Response) return usuario;
    const lista = [...db.iglesias].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return paginarMock(lista, new URL(request.url));
  }),

  http.post(ruta('/iglesias'), async ({ request }) => {
    const usuario = autenticar(request, 'iglesias:crear');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as Partial<CrearIglesia>;
    const nombre = cuerpo.nombre?.trim() ?? '';
    const zonaHoraria = cuerpo.zonaHoraria?.trim() || 'America/Mexico_City';
    const errores: DetalleError[] = [];
    if (!nombre) errores.push({ campo: 'nombre', mensaje: 'Escribe el nombre.' });
    if (!cuerpo.tipo || !TIPOS.includes(cuerpo.tipo)) {
      errores.push({ campo: 'tipo', mensaje: 'Elige un tipo de iglesia válido.' });
    }
    if (!zonaValida(zonaHoraria)) {
      errores.push({
        campo: 'zonaHoraria',
        mensaje: 'Zona horaria no válida (ej. America/Mexico_City).',
      });
    }
    if (errores.length > 0) {
      return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', errores);
    }
    if (db.iglesias.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())) {
      return errorApi(409, 'CONFLICT', 'Ya existe una iglesia con ese nombre.');
    }
    const iglesia: Iglesia = {
      id: crypto.randomUUID(),
      nombre,
      tipo: cuerpo.tipo as TipoIglesia,
      zonaHoraria,
      activa: true,
      createdAt: ahora(),
      updatedAt: ahora(),
    };
    db.iglesias.push(iglesia);
    return HttpResponse.json({ data: iglesia }, { status: 201 });
  }),
];
