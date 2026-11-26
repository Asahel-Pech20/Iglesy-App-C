// Datos simulados de E2-05–E2-13 (Nataly): catálogo del INEGI, iglesias con ubicación y objetos.
// La parroquia de la demo tiene los objetos de CA-01 (índice 35.5).
// DATOS DE DEMOSTRACIÓN: las «iglesias reales» de abajo usan su nombre, su lugar y el año en que se
// empezó a construir, que son públicos. No llevan teléfono, correo ni cupo. Sus objetos son ejemplos
// conocidos de cada templo con años aproximados, y que estén o no catalogados por el INAH es
// ilustrativo: no son un inventario oficial.
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
  { clave: '01', nombre: 'Aguascalientes' },
  { clave: '02', nombre: 'Baja California' },
  { clave: '03', nombre: 'Baja California Sur' },
  { clave: '04', nombre: 'Campeche' },
  { clave: '05', nombre: 'Coahuila de Zaragoza' },
  { clave: '06', nombre: 'Colima' },
  { clave: '07', nombre: 'Chiapas' },
  { clave: '08', nombre: 'Chihuahua' },
  { clave: '09', nombre: 'Ciudad de México' },
  { clave: '10', nombre: 'Durango' },
  { clave: '11', nombre: 'Guanajuato' },
  { clave: '12', nombre: 'Guerrero' },
  { clave: '13', nombre: 'Hidalgo' },
  { clave: '14', nombre: 'Jalisco' },
  { clave: '15', nombre: 'México' },
  { clave: '16', nombre: 'Michoacán de Ocampo' },
  { clave: '17', nombre: 'Morelos' },
  { clave: '18', nombre: 'Nayarit' },
  { clave: '19', nombre: 'Nuevo León' },
  { clave: '20', nombre: 'Oaxaca' },
  { clave: '21', nombre: 'Puebla' },
  { clave: '22', nombre: 'Querétaro' },
  { clave: '23', nombre: 'Quintana Roo' },
  { clave: '24', nombre: 'San Luis Potosí' },
  { clave: '25', nombre: 'Sinaloa' },
  { clave: '26', nombre: 'Sonora' },
  { clave: '27', nombre: 'Tabasco' },
  { clave: '28', nombre: 'Tamaulipas' },
  { clave: '29', nombre: 'Tlaxcala' },
  { clave: '30', nombre: 'Veracruz de Ignacio de la Llave' },
  { clave: '31', nombre: 'Yucatán' },
  { clave: '32', nombre: 'Zacatecas' },
];

export const municipiosIniciales = (): MunicipioMock[] => [
  { clave: '21114', nombre: 'Puebla', estado: '21' },
  { clave: '21019', nombre: 'Atlixco', estado: '21' },
  { clave: '31050', nombre: 'Mérida', estado: '31' },
  { clave: '09015', nombre: 'Cuauhtémoc', estado: '09' },
  { clave: '09005', nombre: 'Gustavo A. Madero', estado: '09' },
  { clave: '11003', nombre: 'San Miguel de Allende', estado: '11' },
  { clave: '12055', nombre: 'Taxco de Alarcón', estado: '12' },
  { clave: '16053', nombre: 'Morelia', estado: '16' },
  { clave: '20067', nombre: 'Oaxaca de Juárez', estado: '20' },
  { clave: '21140', nombre: 'San Pedro Cholula', estado: '21' },
  { clave: '21119', nombre: 'San Andrés Cholula', estado: '21' },
  { clave: '07078', nombre: 'San Cristóbal de las Casas', estado: '07' },
  { clave: '14039', nombre: 'Guadalajara', estado: '14' },
  { clave: '22014', nombre: 'Querétaro', estado: '22' },
  { clave: '29033', nombre: 'Tlaxcala', estado: '29' },
  { clave: '32056', nombre: 'Zacatecas', estado: '32' },
  { clave: '01001', nombre: 'Aguascalientes', estado: '01' },
  { clave: '02004', nombre: 'Tijuana', estado: '02' },
  { clave: '03009', nombre: 'Loreto', estado: '03' },
  { clave: '04002', nombre: 'Campeche', estado: '04' },
  { clave: '05030', nombre: 'Saltillo', estado: '05' },
  { clave: '06002', nombre: 'Colima', estado: '06' },
  { clave: '08019', nombre: 'Chihuahua', estado: '08' },
  { clave: '10005', nombre: 'Durango', estado: '10' },
  { clave: '13003', nombre: 'Actopan', estado: '13' },
  { clave: '15095', nombre: 'Tepotzotlán', estado: '15' },
  { clave: '17007', nombre: 'Cuernavaca', estado: '17' },
  { clave: '18017', nombre: 'Tepic', estado: '18' },
  { clave: '19039', nombre: 'Monterrey', estado: '19' },
  { clave: '23008', nombre: 'Solidaridad', estado: '23' },
  { clave: '24028', nombre: 'San Luis Potosí', estado: '24' },
  { clave: '25012', nombre: 'Mazatlán', estado: '25' },
  { clave: '26030', nombre: 'Hermosillo', estado: '26' },
  { clave: '27004', nombre: 'Centro', estado: '27' },
  { clave: '28038', nombre: 'Tampico', estado: '28' },
  { clave: '30087', nombre: 'Xalapa', estado: '30' },
];

export const localidadesIniciales = (): LocalidadMock[] => [
  { clave: '211140001', nombre: 'Heroica Puebla de Zaragoza', municipio: '21114' },
  { clave: '210190001', nombre: 'Atlixco', municipio: '21019' },
  { clave: '310500001', nombre: 'Mérida', municipio: '31050' },
  { clave: '090150001', nombre: 'Cuauhtémoc', municipio: '09015' },
  { clave: '090050001', nombre: 'Gustavo A. Madero', municipio: '09005' },
  { clave: '110030001', nombre: 'San Miguel de Allende', municipio: '11003' },
  { clave: '120550001', nombre: 'Taxco de Alarcón', municipio: '12055' },
  { clave: '160530001', nombre: 'Morelia', municipio: '16053' },
  { clave: '200670001', nombre: 'Oaxaca de Juárez', municipio: '20067' },
  { clave: '211400001', nombre: 'San Pedro Cholula', municipio: '21140' },
  { clave: '211190001', nombre: 'San Andrés Cholula', municipio: '21119' },
  { clave: '070780001', nombre: 'San Cristóbal de las Casas', municipio: '07078' },
  { clave: '140390001', nombre: 'Guadalajara', municipio: '14039' },
  { clave: '220140001', nombre: 'Santiago de Querétaro', municipio: '22014' },
  { clave: '290330001', nombre: 'Tlaxcala de Xicohténcatl', municipio: '29033' },
  { clave: '320560001', nombre: 'Zacatecas', municipio: '32056' },
  { clave: '010010001', nombre: 'Aguascalientes', municipio: '01001' },
  { clave: '020040001', nombre: 'Tijuana', municipio: '02004' },
  { clave: '030090001', nombre: 'Loreto', municipio: '03009' },
  { clave: '040020001', nombre: 'San Francisco de Campeche', municipio: '04002' },
  { clave: '050300001', nombre: 'Saltillo', municipio: '05030' },
  { clave: '060020001', nombre: 'Colima', municipio: '06002' },
  { clave: '080190001', nombre: 'Chihuahua', municipio: '08019' },
  { clave: '100050001', nombre: 'Victoria de Durango', municipio: '10005' },
  { clave: '130030001', nombre: 'Actopan', municipio: '13003' },
  { clave: '150950001', nombre: 'Tepotzotlán', municipio: '15095' },
  { clave: '170070001', nombre: 'Cuernavaca', municipio: '17007' },
  { clave: '180170001', nombre: 'Tepic', municipio: '18017' },
  { clave: '190390001', nombre: 'Monterrey', municipio: '19039' },
  { clave: '230080001', nombre: 'Playa del Carmen', municipio: '23008' },
  { clave: '240280001', nombre: 'San Luis Potosí', municipio: '24028' },
  { clave: '250120001', nombre: 'Mazatlán', municipio: '25012' },
  { clave: '260300001', nombre: 'Hermosillo', municipio: '26030' },
  { clave: '270040001', nombre: 'Villahermosa', municipio: '27004' },
  { clave: '280380001', nombre: 'Tampico', municipio: '28038' },
  { clave: '300870001', nombre: 'Xalapa-Enríquez', municipio: '30087' },
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
  // Iglesias reales (ver la nota del inicio del archivo)
  real(
    'ig-catedral-cdmx',
    'Catedral Metropolitana de la Ciudad de México',
    'CATEDRAL',
    '09',
    '09015',
    {
      direccion: 'Plaza de la Constitución, Centro',
      anioConstruccion: 1573,
    },
  ),
  real('ig-basilica', 'Basílica de Santa María de Guadalupe', 'BASILICA', '09', '09005', {
    direccion: 'Plaza de las Américas 1, Villa de Guadalupe',
    anioConstruccion: 1976,
  }),
  real('ig-catedral-puebla', 'Catedral de Puebla', 'CATEDRAL', '21', '21114', {
    anioConstruccion: 1575,
  }),
  real('ig-remedios', 'Santuario de la Virgen de los Remedios', 'SANTUARIO', '21', '21140', {
    anioConstruccion: 1594,
  }),
  real('ig-santa-prisca', 'Templo de Santa Prisca', 'TEMPLO', '12', '12055', {
    anioConstruccion: 1751,
  }),
  real('ig-santo-domingo-oax', 'Templo de Santo Domingo de Guzmán', 'TEMPLO', '20', '20067', {
    anioConstruccion: 1570,
  }),
  real('ig-catedral-morelia', 'Catedral de Morelia', 'CATEDRAL', '16', '16053', {
    anioConstruccion: 1660,
  }),
  real('ig-san-miguel', 'Parroquia de San Miguel Arcángel', 'PARROQUIA', '11', '11003', {}),
  real('ig-catedral-gdl', 'Catedral de Guadalajara', 'CATEDRAL', '14', '14039', {
    anioConstruccion: 1561,
  }),
  real('ig-expiatorio', 'Templo Expiatorio del Santísimo Sacramento', 'TEMPLO', '14', '14039', {
    anioConstruccion: 1897,
  }),
  real('ig-catedral-zac', 'Catedral de Zacatecas', 'CATEDRAL', '32', '32056', {
    anioConstruccion: 1729,
  }),
  real('ig-ocotlan', 'Basílica de Nuestra Señora de Ocotlán', 'BASILICA', '29', '29033', {}),
  real('ig-tonantzintla', 'Templo de Santa María Tonantzintla', 'TEMPLO', '21', '21119', {}),
  real('ig-acatepec', 'Templo de San Francisco Acatepec', 'TEMPLO', '21', '21119', {}),
  real('ig-santa-rosa', 'Templo de Santa Rosa de Viterbo', 'TEMPLO', '22', '22014', {}),
  real('ig-catedral-sclc', 'Catedral de San Cristóbal de las Casas', 'CATEDRAL', '07', '07078', {}),
  // Una iglesia real por cada estado que no tenía (ver la nota del inicio del archivo)
  real('ig-catedral-ags', 'Catedral Basílica de Aguascalientes', 'CATEDRAL', '01', '01001', {
    anioConstruccion: 1704,
  }),
  real('ig-catedral-tij', 'Catedral de Nuestra Señora de Guadalupe', 'CATEDRAL', '02', '02004', {}),
  real('ig-loreto', 'Misión de Nuestra Señora de Loreto', 'TEMPLO', '03', '03009', {
    anioConstruccion: 1697,
  }),
  real(
    'ig-catedral-camp',
    'Catedral de Nuestra Señora de la Purísima Concepción',
    'CATEDRAL',
    '04',
    '04002',
    {},
  ),
  real('ig-catedral-salt', 'Catedral de Santiago', 'CATEDRAL', '05', '05030', {
    anioConstruccion: 1745,
  }),
  real('ig-catedral-col', 'Catedral Basílica Menor de Colima', 'CATEDRAL', '06', '06002', {}),
  real('ig-catedral-chih', 'Catedral de Chihuahua', 'CATEDRAL', '08', '08019', {
    anioConstruccion: 1725,
  }),
  real('ig-catedral-dgo', 'Catedral Basílica Menor de la Purísima', 'CATEDRAL', '10', '10005', {
    anioConstruccion: 1695,
  }),
  real('ig-actopan', 'Templo de San Nicolás de Tolentino', 'TEMPLO', '13', '13003', {
    anioConstruccion: 1546,
  }),
  real('ig-tepotzotlan', 'Templo de San Francisco Javier', 'TEMPLO', '15', '15095', {
    anioConstruccion: 1670,
  }),
  real('ig-catedral-cva', 'Catedral de Cuernavaca', 'CATEDRAL', '17', '17007', {
    anioConstruccion: 1529,
  }),
  real(
    'ig-catedral-tep',
    'Catedral de Nuestra Señora de la Asunción',
    'CATEDRAL',
    '18',
    '18017',
    {},
  ),
  real(
    'ig-catedral-mty',
    'Catedral Metropolitana de Nuestra Señora de Monterrey',
    'CATEDRAL',
    '19',
    '19039',
    {},
  ),
  real('ig-playa', 'Parroquia de Nuestra Señora del Carmen', 'PARROQUIA', '23', '23008', {}),
  real('ig-carmen-slp', 'Templo del Carmen', 'TEMPLO', '24', '24028', {}),
  real(
    'ig-catedral-maz',
    'Catedral Basílica de la Inmaculada Concepción',
    'CATEDRAL',
    '25',
    '25012',
    {},
  ),
  real('ig-catedral-hmo', 'Catedral de la Asunción', 'CATEDRAL', '26', '26030', {}),
  real('ig-catedral-vsa', 'Catedral del Señor de Tabasco', 'CATEDRAL', '27', '27004', {}),
  real('ig-catedral-tam', 'Catedral de la Inmaculada Concepción', 'CATEDRAL', '28', '28038', {}),
  real('ig-catedral-xal', 'Catedral Metropolitana de Xalapa', 'CATEDRAL', '30', '30087', {}),
];

/** Una iglesia real: nombre, tipo y lugar; sin contacto ni cupo (datos de demostración). */
function real(
  id: string,
  nombre: string,
  tipo: Iglesia['tipo'],
  estado: string,
  municipio: string,
  extra: Partial<Iglesia>,
): Iglesia {
  return {
    id,
    nombre,
    tipo,
    zonaHoraria: 'America/Mexico_City',
    activa: true,
    ...extra,
    ...lugar(estado, municipio),
    createdAt: creada,
    updatedAt: creada,
  };
}

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
  // Iglesias reales: piezas conocidas de cada templo, con años aproximados (ilustrativo)
  objeto('ob-cdmx-1', 'ig-catedral-cdmx', 'Altar de los Reyes', 'RETABLO', { anio: 1737 }),
  objeto('ob-cdmx-2', 'ig-catedral-cdmx', 'Órgano monumental', 'ORGANO', { anio: 1736 }),
  objeto('ob-cdmx-3', 'ig-catedral-cdmx', 'Cristo del Veneno', 'IMAGEN', { siglo: 17 }),
  objeto('ob-bas-1', 'ig-basilica', 'Ayate de la Virgen de Guadalupe', 'IMAGEN', { anio: 1531 }),
  objeto('ob-pue-1', 'ig-catedral-puebla', 'Ciprés del altar mayor', 'RETABLO', { anio: 1819 }),
  objeto('ob-pue-2', 'ig-catedral-puebla', 'Retablo del Altar de los Reyes', 'RETABLO', {
    siglo: 17,
  }),
  objeto('ob-rem-1', 'ig-remedios', 'Imagen de la Virgen de los Remedios', 'IMAGEN', { siglo: 16 }),
  objeto('ob-sp-1', 'ig-santa-prisca', 'Retablo mayor churrigueresco', 'RETABLO', { anio: 1758 }),
  objeto('ob-sp-2', 'ig-santa-prisca', 'Retablo de la Virgen de Guadalupe', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-sdo-1', 'ig-santo-domingo-oax', 'Retablo de la Capilla del Rosario', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-sdo-2', 'ig-santo-domingo-oax', 'Árbol genealógico de Santo Domingo', 'MURAL', {
    siglo: 17,
  }),
  objeto('ob-mor-1', 'ig-catedral-morelia', 'Órgano monumental', 'ORGANO', { anio: 1905 }),
  // Más piezas de las iglesias reales (ilustrativo), para que haya de cada tipo en cada búsqueda
  objeto('ob-mor-2', 'ig-catedral-morelia', 'Señor de la Sacristía', 'IMAGEN', { siglo: 16 }),
  objeto('ob-mor-3', 'ig-catedral-morelia', 'Custodia de plata', 'ORFEBRERIA', { siglo: 18 }),
  objeto('ob-cdmx-4', 'ig-catedral-cdmx', 'Pinturas de la sacristía', 'PINTURA', { anio: 1686 }),
  objeto('ob-cdmx-5', 'ig-catedral-cdmx', 'Sillería del coro', 'MOBILIARIO_LITURGICO', {
    anio: 1695,
  }),
  objeto('ob-cdmx-6', 'ig-catedral-cdmx', 'Libros del cabildo', 'DOCUMENTO', { siglo: 16 }),
  objeto('ob-bas-2', 'ig-basilica', 'Órgano de la basílica', 'ORGANO', { anio: 1976 }),
  objeto('ob-pue-3', 'ig-catedral-puebla', 'Pintura de la cúpula', 'PINTURA', { anio: 1688 }),
  objeto('ob-pue-4', 'ig-catedral-puebla', 'Órgano del coro', 'ORGANO', { siglo: 18 }),
  objeto('ob-sd-4', 'ig-santo-domingo', 'Yesería de la Capilla del Rosario', 'MURAL', {
    anio: 1690,
  }),
  objeto('ob-sd-5', 'ig-santo-domingo', 'Retablo mayor', 'RETABLO', { siglo: 17 }),
  objeto('ob-sp-3', 'ig-santa-prisca', 'Pinturas de la sacristía', 'PINTURA', { anio: 1758 }),
  objeto('ob-sp-4', 'ig-santa-prisca', 'Órgano barroco', 'ORGANO', { siglo: 18 }),
  objeto('ob-sdo-3', 'ig-santo-domingo-oax', 'Virgen del Rosario', 'IMAGEN', { siglo: 18 }),
  objeto('ob-sdo-4', 'ig-santo-domingo-oax', 'Cáliz de plata', 'ORFEBRERIA', { siglo: 17 }),
  objeto('ob-smg-1', 'ig-san-miguel', 'Señor de la Conquista', 'IMAGEN', { siglo: 16 }),
  objeto('ob-smg-2', 'ig-san-miguel', 'Retablo neoclásico', 'RETABLO', { siglo: 19 }),
  objeto('ob-me-2', 'ig-merida', 'Cristo de las Ampollas', 'IMAGEN', { siglo: 17 }),
  objeto('ob-rem-2', 'ig-remedios', 'Púlpito tallado', 'MOBILIARIO_LITURGICO', { siglo: 18 }),
  // Iglesias reales nuevas
  objeto('ob-gdl-1', 'ig-catedral-gdl', 'Virgen de la Rosa', 'IMAGEN', { siglo: 16 }),
  objeto('ob-gdl-2', 'ig-catedral-gdl', 'Órgano monumental', 'ORGANO', { siglo: 19 }),
  objeto('ob-gdl-3', 'ig-catedral-gdl', 'Pinturas de la sacristía', 'PINTURA', { siglo: 17 }),
  objeto('ob-exp-1', 'ig-expiatorio', 'Vitrales', 'OTRO', { siglo: 20 }),
  objeto('ob-exp-2', 'ig-expiatorio', 'Reloj con carrillón', 'MOBILIARIO_LITURGICO', {
    siglo: 20,
  }),
  objeto('ob-zac-1', 'ig-catedral-zac', 'Pinturas virreinales', 'PINTURA', { siglo: 18 }),
  objeto('ob-zac-2', 'ig-catedral-zac', 'Custodia de plata', 'ORFEBRERIA', { siglo: 18 }),
  objeto('ob-oco-1', 'ig-ocotlan', 'Virgen de Ocotlán', 'IMAGEN', { siglo: 16 }),
  objeto('ob-oco-2', 'ig-ocotlan', 'Retablos del camarín', 'RETABLO', { siglo: 18 }),
  objeto('ob-ton-1', 'ig-tonantzintla', 'Yesería policromada del interior', 'MURAL', {
    siglo: 17,
  }),
  objeto('ob-ton-2', 'ig-tonantzintla', 'Santa María Tonantzintla', 'IMAGEN', { siglo: 18 }),
  objeto('ob-aca-1', 'ig-acatepec', 'Fachada de azulejo de talavera', 'OTRO', { siglo: 18 }),
  objeto('ob-aca-2', 'ig-acatepec', 'Retablo mayor', 'RETABLO', { siglo: 18 }),
  objeto('ob-sr-1', 'ig-santa-rosa', 'Retablos barrocos', 'RETABLO', { siglo: 18 }),
  objeto('ob-sr-2', 'ig-santa-rosa', 'Órgano del coro', 'ORGANO', { siglo: 18 }),
  objeto('ob-sr-3', 'ig-santa-rosa', 'Púlpito con incrustaciones', 'MOBILIARIO_LITURGICO', {
    siglo: 18,
  }),
  objeto('ob-scl-1', 'ig-catedral-sclc', 'Retablo del altar mayor', 'RETABLO', { siglo: 18 }),
  objeto('ob-scl-2', 'ig-catedral-sclc', 'Pinturas virreinales', 'PINTURA', { siglo: 18 }),
  // Piezas de las iglesias de los estados nuevos (ilustrativo)
  objeto('ob-catedral-ags-1', 'ig-catedral-ags', 'Retablo mayor', 'RETABLO', { siglo: 18 }),
  objeto('ob-catedral-ags-2', 'ig-catedral-ags', 'Pinturas de Miguel Cabrera', 'PINTURA', {
    siglo: 18,
  }),
  objeto('ob-catedral-tij-1', 'ig-catedral-tij', 'Imagen de la Virgen de Guadalupe', 'IMAGEN', {
    siglo: 20,
  }),
  objeto('ob-loreto-1', 'ig-loreto', 'Virgen de Loreto', 'IMAGEN', { siglo: 17 }),
  objeto('ob-loreto-2', 'ig-loreto', 'Retablo dorado', 'RETABLO', { siglo: 18 }),
  objeto('ob-catedral-camp-1', 'ig-catedral-camp', 'Santo Entierro de ébano y plata', 'IMAGEN', {
    siglo: 17,
  }),
  objeto('ob-catedral-salt-1', 'ig-catedral-salt', 'Santo Cristo de la Capilla', 'IMAGEN', {
    siglo: 17,
  }),
  objeto('ob-catedral-salt-2', 'ig-catedral-salt', 'Retablos churriguerescos', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-catedral-col-1', 'ig-catedral-col', 'Altar neoclásico', 'RETABLO', { siglo: 19 }),
  objeto('ob-catedral-chih-1', 'ig-catedral-chih', 'Órgano alemán', 'ORGANO', { siglo: 19 }),
  objeto('ob-catedral-chih-2', 'ig-catedral-chih', 'Retablo de los Reyes', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-catedral-dgo-1', 'ig-catedral-dgo', 'Sillería del coro', 'MOBILIARIO_LITURGICO', {
    siglo: 18,
  }),
  objeto('ob-catedral-dgo-2', 'ig-catedral-dgo', 'Pinturas virreinales', 'PINTURA', { siglo: 18 }),
  objeto('ob-actopan-1', 'ig-actopan', 'Pintura mural de la escalera', 'MURAL', { siglo: 16 }),
  objeto('ob-tepotzotlan-1', 'ig-tepotzotlan', 'Retablos churriguerescos', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-tepotzotlan-2', 'ig-tepotzotlan', 'Camarín de la Virgen de Loreto', 'OTRO', {
    siglo: 18,
  }),
  objeto('ob-catedral-cva-1', 'ig-catedral-cva', 'Pintura mural de los mártires', 'MURAL', {
    siglo: 17,
  }),
  objeto('ob-catedral-tep-1', 'ig-catedral-tep', 'Altar mayor', 'RETABLO', { siglo: 19 }),
  objeto('ob-catedral-mty-1', 'ig-catedral-mty', 'Pintura mural del presbiterio', 'MURAL', {
    siglo: 20,
  }),
  objeto('ob-playa-1', 'ig-playa', 'Imagen de la Virgen del Carmen', 'IMAGEN', { siglo: 20 }),
  objeto('ob-carmen-slp-1', 'ig-carmen-slp', 'Retablo de la Virgen del Carmen', 'RETABLO', {
    siglo: 18,
  }),
  objeto('ob-carmen-slp-2', 'ig-carmen-slp', 'Camarín de la Virgen', 'OTRO', { siglo: 18 }),
  objeto('ob-catedral-maz-1', 'ig-catedral-maz', 'Altar mayor', 'RETABLO', { siglo: 19 }),
  objeto('ob-catedral-hmo-1', 'ig-catedral-hmo', 'Imagen de la Virgen de la Asunción', 'IMAGEN', {
    siglo: 19,
  }),
  objeto('ob-catedral-vsa-1', 'ig-catedral-vsa', 'Imagen del Señor de Tabasco', 'IMAGEN', {
    siglo: 20,
  }),
  objeto('ob-catedral-tam-1', 'ig-catedral-tam', 'Órgano', 'ORGANO', { siglo: 20 }),
  objeto(
    'ob-catedral-xal-1',
    'ig-catedral-xal',
    'Imagen de la Virgen de la Inmaculada Concepción',
    'IMAGEN',
    { siglo: 18 },
  ),
];

/** Versiones guardadas de los criterios (vacío = los iniciales del caso). */
export const criteriosIniciales = (): VersionCriterios[] => [];
