import type { ConfiguracionIglesia, HorarioReunion } from '@/app/tipos/configuracion';
import type { Usuario } from '@/app/tipos/usuarios';

/** Contraseña de todos los usuarios de prueba en modo mocks (VITE_USE_MOCKS=true). */
export const PASSWORD_MOCK = 'Iglesia123';

const fecha = '2026-10-01T15:00:00.000Z';

/** Iglesia de la demo (la de los usuarios de prueba) y otra para probar el aislamiento entre iglesias. */
export const IGLESIA_MOCK = 'ig-comunidad';
export const OTRA_IGLESIA_MOCK = 'ig-otra';

export const usuariosIniciales = (): Usuario[] => [
  {
    id: 'u-coordinacion',
    nombre: 'Coordinación Nacional',
    email: 'coordinacion@iglesia.local',
    rol: 'COORDINACION',
    iglesiaId: null,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-admin',
    nombre: 'Administrador General',
    email: 'admin@iglesia.local',
    rol: 'ADMIN_IGLESIA',
    iglesiaId: IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: fecha,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-pastor',
    nombre: 'Pastor Daniel Ruiz',
    email: 'pastor@iglesia.local',
    rol: 'PASTOR',
    iglesiaId: IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-secretario',
    nombre: 'Lucía Hernández',
    email: 'secretario@iglesia.local',
    rol: 'SECRETARIO',
    iglesiaId: IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-tesorero',
    nombre: 'Jorge Canul',
    email: 'tesorero@iglesia.local',
    rol: 'TESORERO',
    iglesiaId: IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-tesorero2',
    nombre: 'Tesorería de otra iglesia',
    email: 'tesorero2@iglesia.local',
    rol: 'TESORERO',
    iglesiaId: OTRA_IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
  {
    id: 'u-coordinador',
    nombre: 'María Chan',
    email: 'coordinador@iglesia.local',
    rol: 'COORDINADOR',
    iglesiaId: IGLESIA_MOCK,
    activo: true,
    ultimoAcceso: null,
    createdAt: fecha,
    updatedAt: fecha,
  },
];

export const configuracionInicial = (): ConfiguracionIglesia => ({
  nombre: 'Iglesia Comunidad de Fe',
  logoUrl: null,
  direccion: 'Calle 60 #123, Centro',
  ciudad: 'Mérida, Yucatán',
  telefono: '999 123 4567',
  email: 'contacto@iglesia.local',
  sitioWeb: null,
  moneda: 'MXN',
  zonaHoraria: 'America/Mexico_City',
});

export const horariosIniciales = (): HorarioReunion[] => [
  {
    id: 'h-1',
    nombre: 'Culto dominical',
    diaSemana: 0,
    horaInicio: '10:00',
    horaFin: '12:00',
    lugar: 'Templo principal',
    activo: true,
  },
  {
    id: 'h-2',
    nombre: 'Escuela dominical',
    diaSemana: 0,
    horaInicio: '08:30',
    horaFin: '09:30',
    lugar: 'Salones',
    activo: true,
  },
  {
    id: 'h-3',
    nombre: 'Estudio bíblico',
    diaSemana: 3,
    horaInicio: '19:00',
    horaFin: '20:30',
    lugar: 'Templo principal',
    activo: true,
  },
];
