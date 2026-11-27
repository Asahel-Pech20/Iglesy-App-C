// Iglesias REALES de México con foto (2026-11-26, pedido del equipo para la demo con el maestro).
// - Fuente: Wikidata (nombre, municipio del INEGI, año y coordenadas) y Wikimedia Commons (la foto,
//   con su autor y su licencia CC BY / CC BY-SA / CC0). Al menos 5 por estado; ver
//   `datos/iglesias-reales.json` y docs/despliegue-render.md.
// - Lo real es el nombre, el lugar y la foto. Sus OBJETOS son ilustrativos (marcados así en la
//   descripción) y por eso su índice también: el caso pide marcar los datos ficticios.
// - Sin teléfono, correo ni cupo. La foto se enlaza a Commons, no se descarga.
// - Idempotente: una iglesia que ya existe (mismo nombre y municipio) solo actualiza su foto.
import { readFileSync } from 'node:fs';
import type { TipoIglesia, TipoObjeto } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import * as catalogosService from '../src/modules/catalogos/catalogos.service';
import { ESTADOS } from './seed-patrimonio';

interface IglesiaReal {
  nombre: string;
  tipo: TipoIglesia;
  estado: string;
  municipio: string;
  municipioNombre: string;
  direccion: string | null;
  anioConstruccion: number | null;
  latitud: number | null;
  longitud: number | null;
  fotoUrl: string;
  fotoAutor: string;
  fotoLicencia: string;
  fotoLicenciaUrl: string | null;
  fotoEnlace: string;
}

/** Zona horaria por estado (la mayoría usa la del centro). */
const ZONAS: Record<string, string> = {
  '02': 'America/Tijuana',
  '03': 'America/Mazatlan',
  '04': 'America/Merida',
  '08': 'America/Chihuahua',
  '18': 'America/Mazatlan',
  '23': 'America/Cancun',
  '25': 'America/Mazatlan',
  '26': 'America/Hermosillo',
  '31': 'America/Merida',
};

/** Objetos ilustrativos: [descripción, tipo, material]. Se reparten sin azar. */
const PIEZAS: [string, TipoObjeto, string][] = [
  ['Retablo mayor', 'RETABLO', 'Madera dorada'],
  ['Imagen del santo patrono', 'IMAGEN', 'Madera policromada'],
  ['Óleo de la Anunciación', 'PINTURA', 'Óleo sobre tela'],
  ['Custodia', 'ORFEBRERIA', 'Plata dorada'],
  ['Púlpito', 'MOBILIARIO_LITURGICO', 'Madera tallada'],
  ['Campana mayor', 'OTRO', 'Bronce'],
  ['Libro de bautismos', 'DOCUMENTO', 'Papel y piel'],
  ['Órgano tubular', 'ORGANO', 'Madera y estaño'],
];

export function leerIglesiasReales(): IglesiaReal[] {
  const ruta = new URL('./datos/iglesias-reales.json', import.meta.url);
  return JSON.parse(readFileSync(ruta, 'utf8')) as IglesiaReal[];
}

/** Tres objetos ilustrativos por iglesia; su época parte del año de la iglesia si se conoce. */
function objetosDe(i: number, anio: number | null) {
  return [0, 1, 2].map((n) => {
    const [descripcion, tipo, material] = PIEZAS[(i * 3 + n) % PIEZAS.length] as [
      string,
      TipoObjeto,
      string,
    ];
    const base = anio ?? 1650 + ((i * 37) % 300);
    const anioPieza = Math.min(2000, base + n * 40);
    return {
      descripcion: `${descripcion} (ilustrativo)`,
      tipo,
      anio: anioPieza,
      siglo: null,
      material,
      estadoConservacion: 'Bueno',
      ubicacionEnTemplo: n === 0 ? 'Altar mayor' : 'Nave lateral',
      catalogadoInah: false,
      estado: 'VIGENTE' as const,
    };
  });
}

export async function seedIglesiasReales() {
  const iglesias = leerIglesiasReales();
  const nombreEstado = new Map(ESTADOS);

  // Municipios del catálogo del INEGI donde están (los estados ya los cargó el seed de patrimonio)
  const municipios = new Map(iglesias.map((i) => [i.municipio, i]));
  await catalogosService.importar(
    [...municipios.values()].map((i) => ({
      cveEnt: i.estado,
      nomEnt: nombreEstado.get(i.estado) as string,
      cveMun: i.municipio.slice(2),
      nomMun: i.municipioNombre,
    })),
  );

  let creadas = 0;
  for (const [n, r] of iglesias.entries()) {
    const foto = {
      fotoUrl: r.fotoUrl,
      fotoAutor: r.fotoAutor,
      fotoLicencia: r.fotoLicencia,
      fotoLicenciaUrl: r.fotoLicenciaUrl,
      fotoEnlace: r.fotoEnlace,
    };
    const existente = await prisma.iglesia.findFirst({
      where: { nombre: r.nombre, municipioClave: r.municipio },
      select: { id: true },
    });
    if (existente) {
      await prisma.iglesia.update({ where: { id: existente.id }, data: foto });
      continue;
    }
    await prisma.iglesia.create({
      data: {
        nombre: r.nombre,
        tipo: r.tipo,
        zonaHoraria: ZONAS[r.estado] ?? 'America/Mexico_City',
        estadoClave: r.estado,
        municipioClave: r.municipio,
        direccion: r.direccion,
        anioConstruccion: r.anioConstruccion,
        latitud: r.latitud,
        longitud: r.longitud,
        ...foto,
        objetos: { create: objetosDe(n, r.anioConstruccion) },
      },
    });
    creadas += 1;
  }
  return {
    iglesias: iglesias.length,
    creadas,
    estados: new Set(iglesias.map((i) => i.estado)).size,
  };
}
