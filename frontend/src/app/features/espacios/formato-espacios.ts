import type { VarianteBadge } from '@/app/compartido/badge-estado';
import { formatearFecha } from '@/app/core/formato';
import type { ClaseEspacio, EstadoSolicitud, FechaLocal } from '@/app/tipos/espacios';

export const ETIQUETAS_CLASE: Record<ClaseEspacio, string> = {
  CRIPTA: 'Cripta',
  NICHO: 'Nicho',
  COLUMBARIO: 'Columbario',
  OSARIO: 'Osario',
};

export const CLASES: ClaseEspacio[] = ['CRIPTA', 'NICHO', 'COLUMBARIO', 'OSARIO'];

export const ETIQUETAS_ESTADO: Record<EstadoSolicitud, string> = {
  RECIBIDA: 'Recibida',
  SIN_LUGAR: 'Sin lugar',
  COTIZADA: 'Cotizada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

export const ESTADOS: EstadoSolicitud[] = [
  'RECIBIDA',
  'SIN_LUGAR',
  'COTIZADA',
  'ACEPTADA',
  'RECHAZADA',
  'VENCIDA',
  'CANCELADA',
];

export function varianteEstado(estado: EstadoSolicitud): VarianteBadge {
  switch (estado) {
    case 'ACEPTADA':
      return 'exito';
    case 'COTIZADA':
      return 'primario';
    case 'RECIBIDA':
      return 'alerta';
    case 'SIN_LUGAR':
    case 'RECHAZADA':
    case 'VENCIDA':
      return 'peligro';
    case 'CANCELADA':
      return 'neutro';
  }
}

/** Lo que significa cada estado, dicho a quien hizo la solicitud. */
export const EXPLICACION_ESTADO: Record<EstadoSolicitud, string> = {
  RECIBIDA: 'La iglesia ya recibió tu solicitud y la está revisando.',
  SIN_LUGAR: 'La iglesia avisó que por ahora no hay lugar de este tipo.',
  COTIZADA:
    'La iglesia te envió una cotización. Puedes aceptarla o rechazarla mientras esté vigente.',
  ACEPTADA: 'Aceptaste la cotización. La iglesia se pondrá en contacto contigo.',
  RECHAZADA: 'Rechazaste la cotización.',
  VENCIDA: 'La cotización venció sin respuesta. Si todavía te interesa, haz una nueva solicitud.',
  CANCELADA: 'Cancelaste esta solicitud.',
};

/** «dd/MM/yyyy HH:mm» a partir de la fecha y hora locales de la iglesia (no se vuelve a convertir). */
export function fechaHoraLocal(f: FechaLocal): string {
  return `${formatearFecha(f.fecha)} ${f.hora}`;
}
