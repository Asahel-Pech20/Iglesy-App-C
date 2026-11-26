import type { ClaseEspacio, EstadoSolicitud } from '@/app/tipos/espacios';
import { IGLESIA_MOCK, OTRA_IGLESIA_MOCK } from './b1';

// Datos simulados de espacios (E4-08 a E4-11). Las fechas se calculan respecto a hoy para que la
// vigencia de 15 días se vea igual sin importar el día en que se ejecute.

export interface TipoEspacioMock {
  id: string;
  iglesiaId: string;
  clase: ClaseEspacio;
  activo: boolean;
  disponible: boolean;
}

export interface SolicitudEspacioMock {
  id: string;
  folio: string;
  /** Solo en los mocks: en el backend se guarda únicamente su hash */
  clave: string;
  iglesiaId: string;
  tipoEspacioId: string;
  contactoNombre: string;
  contactoTelefono: string | null;
  contactoCorreo: string | null;
  comentarios: string | null;
  /** Estado guardado: una cotizada vencida se ve «VENCIDA» sin haberse guardado */
  estado: EstadoSolicitud;
  intentosFallidos: number;
  bloqueadoHasta: string | null;
  createdAt: string;
}

export interface CotizacionMock {
  id: string;
  solicitudId: string;
  monto: string;
  condiciones: string;
  emitidaEn: string;
  venceEn: string;
  respuesta: 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | null;
  respondidaEn: string | null;
}

/** Clave de todas las solicitudes de demostración (se escribe con o sin guion) */
export const CLAVE_MOCK = 'ABCDE-FGHJK';

export const DIA_MS = 24 * 60 * 60 * 1000;
export const VIGENCIA_DIAS = 15;

const haceDias = (dias: number) => new Date(Date.now() - dias * DIA_MS).toISOString();
const venceEn = (emitidaEn: string) =>
  new Date(new Date(emitidaEn).getTime() + VIGENCIA_DIAS * DIA_MS).toISOString();

export const tiposEspacioIniciales = (): TipoEspacioMock[] => [
  { id: 'te-cripta', iglesiaId: IGLESIA_MOCK, clase: 'CRIPTA', activo: true, disponible: true },
  { id: 'te-nicho', iglesiaId: IGLESIA_MOCK, clase: 'NICHO', activo: true, disponible: true },
  {
    id: 'te-columbario',
    iglesiaId: IGLESIA_MOCK,
    clase: 'COLUMBARIO',
    activo: true,
    disponible: false,
  },
  { id: 'te-osario', iglesiaId: IGLESIA_MOCK, clase: 'OSARIO', activo: false, disponible: true },
  { id: 'te-otra', iglesiaId: OTRA_IGLESIA_MOCK, clase: 'CRIPTA', activo: true, disponible: true },
];

/** Correo del cliente de la demo (cliente@iglesia.local): estas solicitudes salen en «Mis solicitudes». */
export const CORREO_CLIENTE_MOCK = 'cliente@iglesia.local';
const DEL_CLIENTE = new Set([1, 2, 5]);

const base = (n: number, tipo: string, estado: EstadoSolicitud, dias: number, nombre: string) => ({
  id: `so-${n}`,
  folio: `ESP-2026-${String(n).padStart(6, '0')}`,
  clave: CLAVE_MOCK,
  iglesiaId: IGLESIA_MOCK,
  tipoEspacioId: tipo,
  contactoNombre: nombre,
  contactoTelefono: '9991234567',
  contactoCorreo: DEL_CLIENTE.has(n) ? CORREO_CLIENTE_MOCK : null,
  comentarios: null,
  estado,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  createdAt: haceDias(dias),
});

export const solicitudesEspacioIniciales = (): SolicitudEspacioMock[] => [
  base(1, 'te-cripta', 'RECIBIDA', 1, 'Ana Pérez Uc'),
  base(2, 'te-nicho', 'COTIZADA', 5, 'Luis Canul Poot'),
  base(3, 'te-cripta', 'COTIZADA', 25, 'María Dzul Chan'),
  base(4, 'te-nicho', 'SIN_LUGAR', 8, 'Pedro Euán Ku'),
  base(5, 'te-cripta', 'ACEPTADA', 12, 'Rosa May Tun'),
  base(6, 'te-nicho', 'CANCELADA', 9, 'Jorge Cauich Dzib'),
  {
    ...base(7, 'te-otra', 'RECIBIDA', 2, 'Persona de otra iglesia'),
    iglesiaId: OTRA_IGLESIA_MOCK,
  },
];

export const cotizacionesIniciales = (): CotizacionMock[] => {
  const c = (
    n: number,
    solicitud: string,
    monto: string,
    dias: number,
    respuesta: CotizacionMock['respuesta'],
  ): CotizacionMock => {
    const emitidaEn = haceDias(dias);
    return {
      id: `co-${n}`,
      solicitudId: solicitud,
      monto,
      condiciones: 'Anticipo del 50 % y el resto al entregar el espacio.',
      emitidaEn,
      venceEn: venceEn(emitidaEn),
      respuesta,
      respondidaEn: respuesta ? haceDias(Math.max(0, dias - 1)) : null,
    };
  };
  return [
    c(1, 'so-2', '12500.50', 3, null),
    // Emitida hace 20 días: ya venció aunque nadie haya guardado ese cambio
    c(2, 'so-3', '8000.00', 20, null),
    c(3, 'so-5', '9500.00', 10, 'ACEPTADA'),
  ];
};
