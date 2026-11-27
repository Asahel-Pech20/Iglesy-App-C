import { http, HttpResponse } from 'msw';
import type {
  EditarConfiguracion,
  GuardarHorario,
  HorarioReunion,
} from '@/app/tipos/configuracion';
import { db } from '../db';
import { autenticar, errorApi, ruta } from '../utils';

const CAMPOS_EDITABLES: readonly string[] = ['sitioWeb', 'moneda', 'zonaHoraria'];

const ordenarHorarios = (lista: HorarioReunion[]) =>
  [...lista].sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));

function validarHoras(h: Partial<GuardarHorario>) {
  if (h.horaFin && h.horaInicio && h.horaFin <= h.horaInicio) {
    return errorApi(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
      { campo: 'horaFin', mensaje: 'La hora de fin debe ser posterior a la de inicio.' },
    ]);
  }
  return null;
}

async function aDataUrl(archivo: File) {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let binario = '';
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return `data:${archivo.type};base64,${btoa(binario)}`;
}

/** Como el backend (E1-06b): la Coordinación debe indicar la iglesia con ?iglesiaId=. */
function coordinacionSinIglesia(request: Request) {
  if (!request.headers.get('Authorization')) return null;
  const usuario = autenticar(request);
  if (usuario instanceof Response) return null;
  if (usuario.iglesiaId || new URL(request.url).searchParams.get('iglesiaId')) return null;
  const mensaje = 'La Coordinación debe indicar la iglesia (?iglesiaId=).';
  return errorApi(400, 'VALIDATION_ERROR', mensaje, [{ campo: 'iglesiaId', mensaje }]);
}

export const configuracionHandlers = [
  http.get(ruta('/configuracion'), ({ request }) => {
    const sinIglesia = coordinacionSinIglesia(request);
    return sinIglesia ?? HttpResponse.json({ data: db.configuracion });
  }),

  http.put(ruta('/configuracion'), async ({ request }) => {
    const usuario = autenticar(request, 'configuracion:editar');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as EditarConfiguracion;
    // E1-06b: igual que el backend, solo lo institucional; nombre y contacto van en la ficha
    const ajenos = Object.keys(cuerpo).filter((c) => !CAMPOS_EDITABLES.includes(c));
    if (ajenos.length > 0) {
      return errorApi(
        400,
        'VALIDATION_ERROR',
        'Los datos enviados no son válidos.',
        ajenos.map((campo) => ({ campo, mensaje: 'Se edita en la ficha de la iglesia.' })),
      );
    }
    db.configuracion = { ...db.configuracion, ...cuerpo };
    return HttpResponse.json({ data: db.configuracion });
  }),

  http.post(ruta('/configuracion/logo'), async ({ request }) => {
    const usuario = autenticar(request, 'configuracion:editar');
    if (usuario instanceof Response) return usuario;
    const archivo = (await request.formData()).get('logo');
    if (!(archivo instanceof File)) {
      return errorApi(400, 'VALIDATION_ERROR', 'Debes adjuntar un archivo.');
    }
    db.configuracion.logoUrl = await aDataUrl(archivo);
    return HttpResponse.json({ data: db.configuracion });
  }),

  http.get(ruta('/configuracion/horarios'), ({ request }) => {
    const sinIglesia = coordinacionSinIglesia(request);
    return sinIglesia ?? HttpResponse.json({ data: ordenarHorarios(db.horarios) });
  }),

  http.post(ruta('/configuracion/horarios'), async ({ request }) => {
    const usuario = autenticar(request, 'configuracion:editar');
    if (usuario instanceof Response) return usuario;
    const cuerpo = (await request.json()) as GuardarHorario;
    const error = validarHoras(cuerpo);
    if (error) return error;
    const nuevo = { ...cuerpo, id: crypto.randomUUID() };
    db.horarios.push(nuevo);
    return HttpResponse.json({ data: nuevo }, { status: 201 });
  }),

  http.patch(ruta('/configuracion/horarios/:id'), async ({ request, params }) => {
    const usuario = autenticar(request, 'configuracion:editar');
    if (usuario instanceof Response) return usuario;
    const horario = db.horarios.find((h) => h.id === params.id);
    if (!horario) return errorApi(404, 'NOT_FOUND', 'El horario no existe.');
    const cuerpo = (await request.json()) as Partial<GuardarHorario>;
    const error = validarHoras({ ...horario, ...cuerpo });
    if (error) return error;
    Object.assign(horario, cuerpo);
    return HttpResponse.json({ data: horario });
  }),

  http.delete(ruta('/configuracion/horarios/:id'), ({ request, params }) => {
    const usuario = autenticar(request, 'configuracion:editar');
    if (usuario instanceof Response) return usuario;
    db.horarios = db.horarios.filter((h) => h.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
