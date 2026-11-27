// E2-09 (Nataly): catálogo, 40 iglesias y 120 objetos del patrimonio (specs.md §12.8, «Seeds mínimos»).
// - Catálogo: los 32 estados del INEGI y los municipios y cabeceras (localidad 0001) donde hay
//   iglesias. El catálogo completo se carga con `pnpm --filter backend db:catalogos` (E2-05); como
//   la carga solo inserta y actualiza, no choca con este seed.
// - Iglesias y objetos: datos FICTICIOS (las iglesias llevan «(ficticia)» en el nombre).
// - Determinista e idempotente: sin azar; una iglesia que ya tiene objetos no se vuelve a llenar.
import type { EstadoObjeto, TipoIglesia, TipoObjeto } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import * as catalogosService from '../src/modules/catalogos/catalogos.service';

export const ESTADOS: [string, string][] = [
  ['01', 'Aguascalientes'],
  ['02', 'Baja California'],
  ['03', 'Baja California Sur'],
  ['04', 'Campeche'],
  ['05', 'Coahuila de Zaragoza'],
  ['06', 'Colima'],
  ['07', 'Chiapas'],
  ['08', 'Chihuahua'],
  ['09', 'Ciudad de México'],
  ['10', 'Durango'],
  ['11', 'Guanajuato'],
  ['12', 'Guerrero'],
  ['13', 'Hidalgo'],
  ['14', 'Jalisco'],
  ['15', 'México'],
  ['16', 'Michoacán de Ocampo'],
  ['17', 'Morelos'],
  ['18', 'Nayarit'],
  ['19', 'Nuevo León'],
  ['20', 'Oaxaca'],
  ['21', 'Puebla'],
  ['22', 'Querétaro'],
  ['23', 'Quintana Roo'],
  ['24', 'San Luis Potosí'],
  ['25', 'Sinaloa'],
  ['26', 'Sonora'],
  ['27', 'Tabasco'],
  ['28', 'Tamaulipas'],
  ['29', 'Tlaxcala'],
  ['30', 'Veracruz de Ignacio de la Llave'],
  ['31', 'Yucatán'],
  ['32', 'Zacatecas'],
];

/** [estado, municipio (3 dígitos), nombre del municipio, nombre de la cabecera]. */
const MUNICIPIOS: [string, string, string, string][] = [
  ['21', '114', 'Puebla', 'Heroica Puebla de Zaragoza'],
  ['21', '019', 'Atlixco', 'Atlixco'],
  ['21', '140', 'San Pedro Cholula', 'Cholula de Rivadavia'],
  ['21', '156', 'Tehuacán', 'Tehuacán'],
  ['31', '050', 'Mérida', 'Mérida'],
  ['31', '102', 'Valladolid', 'Valladolid'],
  ['31', '040', 'Izamal', 'Izamal'],
  ['09', '015', 'Cuauhtémoc', 'Cuauhtémoc'],
  ['09', '003', 'Coyoacán', 'Coyoacán'],
  ['20', '067', 'Oaxaca de Juárez', 'Oaxaca de Juárez'],
  ['11', '015', 'Guanajuato', 'Guanajuato'],
  ['11', '003', 'San Miguel de Allende', 'San Miguel de Allende'],
];

const TIPOS_IGLESIA: TipoIglesia[] = [
  'CATEDRAL',
  'BASILICA',
  'PARROQUIA',
  'TEMPLO',
  'CAPILLA',
  'SANTUARIO',
];

const ADVOCACIONES = [
  'San Miguel Arcángel',
  'Nuestra Señora de la Asunción',
  'San Francisco de Asís',
  'Santo Domingo de Guzmán',
  'San José',
  'Nuestra Señora de Guadalupe',
  'Santa Clara',
  'San Agustín',
  'La Santísima Trinidad',
  'San Juan Bautista',
  'Nuestra Señora de la Soledad',
  'Santiago Apóstol',
  'San Antonio de Padua',
  'La Purísima Concepción',
];

const NOMBRE_TIPO: Record<TipoIglesia, string> = {
  CATEDRAL: 'Catedral de',
  BASILICA: 'Basílica de',
  PARROQUIA: 'Parroquia de',
  TEMPLO: 'Templo de',
  CAPILLA: 'Capilla de',
  SANTUARIO: 'Santuario de',
};

/** Piezas de cada tipo: [descripción, material]. */
const PIEZAS: Record<TipoObjeto, [string, string][]> = {
  IMAGEN: [
    ['Imagen del santo patrono', 'Madera policromada'],
    ['Cristo crucificado', 'Pasta de caña de maíz'],
    ['Virgen de la Asunción', 'Madera estofada'],
  ],
  RETABLO: [
    ['Retablo mayor', 'Madera dorada'],
    ['Retablo lateral', 'Madera tallada'],
  ],
  PINTURA: [
    ['Óleo de la Anunciación', 'Óleo sobre tela'],
    ['Pintura de las ánimas', 'Óleo sobre tabla'],
  ],
  MURAL: [['Mural del bautisterio', 'Pintura al fresco']],
  ORGANO: [['Órgano tubular', 'Madera y estaño']],
  PIANO: [['Piano vertical', 'Madera']],
  ORFEBRERIA: [
    ['Par de candelabros', 'Plata'],
    ['Custodia', 'Plata dorada'],
  ],
  MOBILIARIO_LITURGICO: [
    ['Púlpito', 'Madera tallada'],
    ['Sillería del coro', 'Cedro'],
  ],
  DOCUMENTO: [['Libro de bautismos', 'Papel y piel']],
  OTRO: [['Campana', 'Bronce']],
};

const TIPOS_OBJETO = Object.keys(PIEZAS) as TipoObjeto[];
const CONSERVACION = ['Bueno', 'Regular', 'Restaurado', 'Requiere restauración'];
const UBICACION = ['Altar mayor', 'Nave lateral', 'Sacristía', 'Coro', 'Capilla del Santísimo'];

interface ObjetoSeed {
  descripcion: string;
  tipo: TipoObjeto;
  anio: number | null;
  siglo: number | null;
  material: string;
  estadoConservacion: string;
  ubicacionEnTemplo: string;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
  fechaEstado: Date | null;
  motivoEstado: string | null;
}

/** La parroquia de CA-01 (índice 35.5 en 2026) más un objeto dado de baja (CA-04). */
const OBJETOS_CA01: ObjetoSeed[] = [
  ['Imagen de San Miguel Arcángel', 'IMAGEN', 1720, null, 'Madera policromada', true],
  ['Retablo lateral', 'RETABLO', null, 18, 'Madera dorada', false],
  ['Par de candelabros de plata', 'ORFEBRERIA', 1890, null, 'Plata', false],
  ['Piano vertical', 'PIANO', 1950, null, 'Madera', false],
  ['Cáliz antiguo', 'ORFEBRERIA', 1780, null, 'Plata dorada', false],
].map(([descripcion, tipo, anio, siglo, material, inah], i) => ({
  descripcion: descripcion as string,
  tipo: tipo as TipoObjeto,
  anio: anio as number | null,
  siglo: siglo as number | null,
  material: material as string,
  estadoConservacion: 'Bueno',
  ubicacionEnTemplo: UBICACION[i % UBICACION.length] as string,
  catalogadoInah: inah as boolean,
  estado: i === 4 ? 'BAJA' : 'VIGENTE',
  fechaEstado: i === 4 ? new Date('2025-06-30') : null,
  motivoEstado: i === 4 ? 'Robo denunciado; se conserva el registro (dato ficticio)' : null,
}));

/** Objeto número `n` de la iglesia `i`: tipo, época y estado salen de los índices (sin azar). */
function objeto(i: number, n: number): ObjetoSeed {
  const semilla = i * 7 + n * 3;
  const tipo = TIPOS_OBJETO[semilla % TIPOS_OBJETO.length] as TipoObjeto;
  const piezas = PIEZAS[tipo];
  const [descripcion, material] = piezas[semilla % piezas.length] as [string, string];
  // Épocas de 1560 a 2010; una de cada cinco piezas solo tiene el siglo (RF-17)
  const anioBase = 1560 + ((semilla * 37) % 451);
  const soloSiglo = semilla % 5 === 0;
  // Uno de cada 15 está prestado y uno de cada 23, perdido (RN-11)
  const estado: EstadoObjeto =
    semilla % 15 === 7 ? 'PRESTADO' : semilla % 23 === 11 ? 'PERDIDO' : 'VIGENTE';
  return {
    descripcion,
    tipo,
    anio: soloSiglo ? null : anioBase,
    siglo: soloSiglo ? Math.ceil(anioBase / 100) : null,
    material,
    estadoConservacion: CONSERVACION[semilla % CONSERVACION.length] as string,
    ubicacionEnTemplo: UBICACION[semilla % UBICACION.length] as string,
    catalogadoInah: anioBase < 1800 && semilla % 3 === 0,
    estado,
    fechaEstado: estado === 'VIGENTE' ? null : new Date('2026-03-01'),
    motivoEstado:
      estado === 'PRESTADO'
        ? 'Préstamo para una exposición (dato ficticio)'
        : estado === 'PERDIDO'
          ? 'No se encontró en el inventario (dato ficticio)'
          : null,
  };
}

/** Las 40 iglesias: la de CA-01 primero, una cerrada y una sin objetos para la demo del ranking. */
function iglesiasSeed() {
  return Array.from({ length: 40 }, (_, i) => {
    const [estado, mun, , ciudad] = MUNICIPIOS[i % MUNICIPIOS.length] as [
      string,
      string,
      string,
      string,
    ];
    const tipo = i === 0 ? 'PARROQUIA' : (TIPOS_IGLESIA[i % TIPOS_IGLESIA.length] as TipoIglesia);
    const advocacion =
      i === 0 ? 'San Miguel Arcángel' : (ADVOCACIONES[i % ADVOCACIONES.length] as string);
    const municipio = `${estado}${mun}`;
    // Objetos: CA-01 lleva 5; la última, ninguno; la segunda, 4; las demás, 3 → 120 en total
    const objetos =
      i === 0
        ? OBJETOS_CA01
        : i === 39
          ? []
          : Array.from({ length: i === 1 ? 4 : 3 }, (_, n) => objeto(i, n));
    return {
      nombre: `${NOMBRE_TIPO[tipo]} ${advocacion}, ${ciudad} (ficticia)`,
      tipo,
      zonaHoraria: estado === '31' ? 'America/Merida' : 'America/Mexico_City',
      direccion: `Calle ${(i % 20) + 1} Poniente ${100 + i * 3}, Centro (ficticia)`,
      estadoClave: estado,
      municipioClave: municipio,
      localidadClave: `${municipio}0001`,
      capacidad: 80 + ((i * 53) % 900),
      anioConstruccion: 1550 + ((i * 41) % 420),
      telefono: `222${String(1000000 + i * 7919).slice(-7)}`,
      // La iglesia 38 cerró: conserva su historia pero no aparece en lo público (RN-07)
      activa: i !== 38,
      ...(i === 38 && {
        fechaCierre: new Date('2025-09-19'),
        motivoCierre: 'Daños estructurales por sismo (dato ficticio)',
      }),
      objetos,
    };
  });
}

/** Verifica los mínimos del caso antes de escribir nada (specs.md §12.8). */
function verificarMinimos(iglesias: ReturnType<typeof iglesiasSeed>, anioCalculo: number) {
  const objetos = iglesias.flatMap((i) => i.objetos);
  const edad = (o: ObjetoSeed) =>
    anioCalculo - (o.anio ?? (Math.max(1, o.siglo ?? 1) - 1) * 100 + 50);
  const minimos = {
    iglesias: iglesias.length >= 40,
    estados: new Set(iglesias.map((i) => i.estadoClave)).size >= 3,
    municipios: new Set(iglesias.map((i) => i.municipioClave)).size >= 8,
    tipos: new Set(iglesias.map((i) => i.tipo)).size === TIPOS_IGLESIA.length,
    objetos: objetos.length >= 120,
    de200: objetos.filter((o) => edad(o) >= 200).length >= 15,
    de300: objetos.filter((o) => edad(o) >= 300).length >= 5,
  };
  const fallan = Object.entries(minimos).filter(([, ok]) => !ok);
  if (fallan.length)
    throw new Error(`Seed de patrimonio incompleto: ${fallan.map(([k]) => k).join(', ')}`);
}

export async function seedPatrimonio() {
  await catalogosService.importar([
    ...ESTADOS.map(([cveEnt, nomEnt]) => ({ cveEnt, nomEnt })),
    ...MUNICIPIOS.map(([cveEnt, cveMun, nomMun, nomLoc]) => ({
      cveEnt,
      nomEnt: (ESTADOS.find(([c]) => c === cveEnt) as [string, string])[1],
      cveMun,
      nomMun,
      cveLoc: '0001',
      nomLoc,
    })),
  ]);

  const iglesias = iglesiasSeed();
  verificarMinimos(iglesias, new Date().getFullYear());

  let objetosCreados = 0;
  for (const { objetos, ...datos } of iglesias) {
    const existente = await prisma.iglesia.findFirst({ where: { nombre: datos.nombre } });
    const iglesia = existente ?? (await prisma.iglesia.create({ data: datos }));
    if ((await prisma.objetoPatrimonial.count({ where: { iglesiaId: iglesia.id } })) > 0) continue;
    if (objetos.length) {
      await prisma.objetoPatrimonial.createMany({
        data: objetos.map((o) => ({ ...o, iglesiaId: iglesia.id })),
      });
      objetosCreados += objetos.length;
    }
  }
  return {
    estados: ESTADOS.length,
    municipios: MUNICIPIOS.length,
    iglesias: iglesias.length,
    objetos: objetosCreados,
  };
}
