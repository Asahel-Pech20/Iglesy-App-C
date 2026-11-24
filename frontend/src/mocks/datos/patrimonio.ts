// Datos simulados de E2-05–E2-13 (Nataly): catálogo del INEGI, iglesias con ubicación y objetos.
// Ficticios; la parroquia de la demo tiene los objetos de CA-01 (índice 35.5).
import type { Iglesia, LugarInegi } from '@/app/tipos/iglesias';
import type { EstadoObjeto, TipoObjeto, VersionCriterios } from '@/app/tipos/patrimonio';
import { IGLESIA_MOCK } from './b1';

export interface MunicipioMock extends LugarInegi {
  estado: string;
}
export interface LocalidadMock extends LugarInegi {
  municipio: string;
}

export interface ObjetoMock {
  id: string;
  iglesiaId: string;
  descripcion: string;
  tipo: TipoObjeto;
  anio: number | null;
  siglo: number | null;
  material: string;
  estadoConservacion: string;
  ubicacionEnTemplo: string;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
  fechaEstado: string | null;
  motivoEstado: string | null;
  createdAt: string;
  updatedAt: string;
}

export const estadosIniciales = (): LugarInegi[] => [
  { clave: '09', nombre: 'Ciudad de México' },
  { clave: '21', nombre: 'Puebla' },
  { clave: '31', nombre: 'Yucatán' },
];

export const municipiosIniciales = (): MunicipioMock[] => [
  { clave: '21114', nombre: 'Puebla', estado: '21' },
  { clave: '21019', nombre: 'Atlixco', estado: '21' },
  { clave: '31050', nombre: 'Mérida', estado: '31' },
  { clave: '09015', nombre: 'Cuauhtémoc', estado: '09' },
];

export const localidadesIniciales = (): LocalidadMock[] => [
  { clave: '211140001', nombre: 'Heroica Puebla de Zaragoza', municipio: '21114' },
  { clave: '210190001', nombre: 'Atlixco', municipio: '21019' },
  { clave: '310500001', nombre: 'Mérida', municipio: '31050' },
  { clave: '090150001', nombre: 'Cuauhtémoc', municipio: '09015' },
];

const creada = '2026-01-01T00:00:00.000Z';

function lugar(estado: string, municipio: string) {
  const e = estadosIniciales().find((x) => x.clave === estado) ?? null;
  const m = municipiosIniciales().find((x) => x.clave === municipio);
  const l = localidadesIniciales().find((x) => x.municipio === municipio);
  return {
    estado: e,
    municipio: m ? { clave: m.clave, nombre: m.nombre } : null,
    localidad: l ? { clave: l.clave, nombre: l.nombre } : null,
  };
}

/** Ubicación y datos de la ficha de la iglesia de la demo (la de Oscar), en Puebla. */
export function conDatosDeFicha(iglesias: Iglesia[]): Iglesia[] {
  return iglesias.map((i) =>
    i.id === IGLESIA_MOCK
      ? {
          ...i,
          direccion: 'Calle 5 de Mayo 10, Centro',
          capacidad: 400,
          anioConstruccion: 1765,
          telefono: '2221234567',
          correo: 'contacto@parroquia.mx',
          latitud: '19.043100',
          longitud: '-98.198200',
          fechaCierre: null,
          motivoCierre: null,
          ...lugar('21', '21114'),
        }
      : i,
  );
}

/** Iglesias de Ecclesia para las consultas públicas (ficticias). */
export const iglesiasPatrimonioIniciales = (): Iglesia[] => [
  {
    id: 'ig-santo-domingo',
    nombre: 'Templo de Santo Domingo',
    tipo: 'TEMPLO',
    zonaHoraria: 'America/Mexico_City',
    activa: true,
    direccion: 'Av. 5 de Mayo 407',
    capacidad: 800,
    anioConstruccion: 1611,
    ...lugar('21', '21114'),
    createdAt: creada,
    updatedAt: creada,
  },
  {
    id: 'ig-atlixco',
    nombre: 'Capilla de la Tercera Orden',
    tipo: 'CAPILLA',
    zonaHoraria: 'America/Mexico_City',
    activa: true,
    capacidad: 120,
    ...lugar('21', '21019'),
    createdAt: creada,
    updatedAt: creada,
  },
  {
    id: 'ig-cerrada',
    nombre: 'Templo de San Roque',
    tipo: 'TEMPLO',
    zonaHoraria: 'America/Mexico_City',
    activa: false,
    fechaCierre: '2025-09-19',
    motivoCierre: 'Daños por sismo',
    ...lugar('21', '21114'),
    createdAt: creada,
    updatedAt: creada,
  },
  {
    id: 'ig-merida',
    nombre: 'Catedral de San Ildefonso',
    tipo: 'CATEDRAL',
    zonaHoraria: 'America/Merida',
    activa: true,
    capacidad: 1500,
    ...lugar('31', '31050'),
    createdAt: creada,
    updatedAt: creada,
  },
];

function objeto(
  id: string,
  iglesiaId: string,
  descripcion: string,
  tipo: TipoObjeto,
  fecha: { anio?: number; siglo?: number },
  catalogadoInah = false,
  estado: EstadoObjeto = 'VIGENTE',
): ObjetoMock {
  return {
    id,
    iglesiaId,
    descripcion,
    tipo,
    anio: fecha.anio ?? null,
    siglo: fecha.siglo ?? null,
    material: 'Madera',
    estadoConservacion: 'Bueno',
    ubicacionEnTemplo: 'Altar mayor',
    catalogadoInah,
    estado,
    fechaEstado: estado === 'VIGENTE' ? null : '2026-01-15',
    motivoEstado: estado === 'VIGENTE' ? null : 'Robo denunciado',
    createdAt: creada,
    updatedAt: creada,
  };
}

export const objetosIniciales = (): ObjetoMock[] => [
  // CA-01: 20 + 9.1 + 4 + 2.4 = 35.5, Alto valor patrimonial; el cáliz dado de baja no cuenta
  objeto(
    'ob-imagen',
    IGLESIA_MOCK,
    'Imagen de San Miguel Arcángel',
    'IMAGEN',
    { anio: 1720 },
    true,
  ),
  objeto('ob-retablo', IGLESIA_MOCK, 'Retablo lateral', 'RETABLO', { siglo: 18 }),
  objeto('ob-candelabros', IGLESIA_MOCK, 'Par de candelabros de plata', 'ORFEBRERIA', {
    anio: 1890,
  }),
  objeto('ob-piano', IGLESIA_MOCK, 'Piano vertical', 'PIANO', { anio: 1950 }),
  objeto('ob-caliz', IGLESIA_MOCK, 'Cáliz antiguo', 'ORFEBRERIA', { anio: 1780 }, false, 'BAJA'),
  // Santo Domingo: 3 imágenes de más de 300 años = 45, Patrimonio sobresaliente
  objeto('ob-sd-1', 'ig-santo-domingo', 'Virgen del Rosario', 'IMAGEN', { anio: 1690 }),
  objeto('ob-sd-2', 'ig-santo-domingo', 'Cristo de la Columna', 'IMAGEN', { anio: 1650 }),
  objeto('ob-sd-3', 'ig-santo-domingo', 'Santo Domingo de Guzmán', 'IMAGEN', { anio: 1700 }),
  // Mérida: un documento reciente (1 punto)
  objeto('ob-me-1', 'ig-merida', 'Libro de bautismos', 'DOCUMENTO', { anio: 1990 }),
  // La cerrada no aparece en lo público aunque tenga objetos
  objeto('ob-ce-1', 'ig-cerrada', 'Retablo mayor', 'RETABLO', { anio: 1600 }, true),
];

/** Versiones guardadas de los criterios (vacío = los iniciales del caso). */
export const criteriosIniciales = (): VersionCriterios[] => [];
