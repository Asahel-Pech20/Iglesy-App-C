import type { HorarioMisaEntrada } from '@/app/tipos/misas';
import type { PlaticaEntrada, ServicioEntrada } from '@/app/tipos/servicios';
import { IGLESIA_MOCK, OTRA_IGLESIA_MOCK } from './b1';

// Datos simulados de misas, servicios y pláticas (E3-15 a E3-18, Genaro). Espejo del backend.

export interface PadreIglesiaMock {
  padreId: string;
  iglesiaId: string;
  activo: boolean;
}

export interface HorarioMisaMock extends HorarioMisaEntrada {
  id: string;
  iglesiaId: string;
  activo: boolean;
}

export interface SustitucionMock {
  padreProgramadoId: string;
  motivo: string;
  hechaPorId: string;
  hechaEn: string;
}

export interface ServicioMock extends ServicioEntrada {
  id: string;
  iglesiaId: string;
  activo: boolean;
}

export interface PlaticaMock extends PlaticaEntrada {
  id: string;
  iglesiaId: string;
  activo: boolean;
}

/** Los dos padres del diezmo celebran en la iglesia del usuario; Luis también en la otra. */
export const padresIglesiaIniciales = (): PadreIglesiaMock[] => [
  { padreId: 'pa-luis', iglesiaId: IGLESIA_MOCK, activo: true },
  { padreId: 'pa-ana', iglesiaId: IGLESIA_MOCK, activo: true },
  { padreId: 'pa-luis', iglesiaId: OTRA_IGLESIA_MOCK, activo: true },
];

export const horariosMisaIniciales = (): HorarioMisaMock[] => [
  {
    id: 'hm-dom',
    iglesiaId: IGLESIA_MOCK,
    diaSemana: 0,
    hora: '10:00',
    tipo: 'DOMINICAL',
    idioma: 'ESPANOL',
    duracionMin: null,
    padreId: 'pa-luis',
    activo: true,
  },
  {
    id: 'hm-mie',
    iglesiaId: IGLESIA_MOCK,
    diaSemana: 3,
    hora: '19:00',
    tipo: 'DIARIA',
    idioma: 'MAYA',
    duracionMin: 45,
    padreId: 'pa-ana',
    activo: true,
  },
  {
    id: 'hm-otra',
    iglesiaId: OTRA_IGLESIA_MOCK,
    diaSemana: 0,
    hora: '12:00',
    tipo: 'DOMINICAL',
    idioma: 'ESPANOL',
    duracionMin: null,
    padreId: 'pa-luis',
    activo: true,
  },
];

export const serviciosIniciales = (): ServicioMock[] => [
  {
    id: 'sv-bautizo',
    iglesiaId: IGLESIA_MOCK,
    nombre: 'Bautizo',
    formaCosto: 'MONTO',
    monto: '350.00',
    requisitos: 'Acta de nacimiento y plática prebautismal.',
    duracionMin: 60,
    requiereCita: true,
    horarios: [{ diaSemana: 6, hora: '10:00' }],
    activo: true,
  },
  {
    id: 'sv-confirmacion',
    iglesiaId: IGLESIA_MOCK,
    nombre: 'Confirmación',
    formaCosto: 'GRATUITO',
    monto: null,
    requisitos: null,
    duracionMin: null,
    requiereCita: false,
    horarios: [],
    activo: true,
  },
];

export const platicasIniciales = (): PlaticaMock[] => [
  {
    id: 'pl-bautizo',
    iglesiaId: IGLESIA_MOCK,
    tipo: 'PREBAUTISMAL',
    sesiones: 2,
    costo: '0.00',
    cupo: 30,
    lugar: 'Salón parroquial',
    imparte: 'Matrimonio Pérez',
    padreId: null,
    horarios: [{ diaSemana: 3, hora: '19:00' }],
    activo: true,
  },
  {
    id: 'pl-matrimonio',
    iglesiaId: IGLESIA_MOCK,
    tipo: 'PREMATRIMONIAL',
    sesiones: 4,
    costo: '150.00',
    cupo: 20,
    lugar: 'Capilla del Santísimo',
    imparte: 'Pbro. Luis Pérez Cámara',
    padreId: 'pa-luis',
    horarios: [{ diaSemana: 5, hora: '18:00' }],
    activo: true,
  },
];
