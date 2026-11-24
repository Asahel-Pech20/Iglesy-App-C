// Copia del cálculo del backend (backend/src/modules/patrimonio/dominio/indice-patrimonial.ts)
// para que los mocks den los mismos números (CA-01: 35.5). Aritmética en décimas enteras.
import type {
  CriteriosIndice,
  EstadoObjeto,
  GrupoObjeto,
  TipoObjeto,
} from '@/app/tipos/patrimonio';

export const GRUPO_DE_TIPO: Record<TipoObjeto, GrupoObjeto> = {
  IMAGEN: 'IMAGEN',
  RETABLO: 'RETABLO_PINTURA_MURAL',
  PINTURA: 'RETABLO_PINTURA_MURAL',
  MURAL: 'RETABLO_PINTURA_MURAL',
  ORGANO: 'ORGANO_PIANO',
  PIANO: 'ORGANO_PIANO',
  ORFEBRERIA: 'ORFEBRERIA_MOBILIARIO_DOCUMENTO',
  MOBILIARIO_LITURGICO: 'ORFEBRERIA_MOBILIARIO_DOCUMENTO',
  DOCUMENTO: 'ORFEBRERIA_MOBILIARIO_DOCUMENTO',
  OTRO: 'OTRO',
};

export const CRITERIOS_INICIALES: CriteriosIndice = {
  rangosEdad: [
    { desdeAnios: 0, puntos: 1 },
    { desdeAnios: 50, puntos: 2 },
    { desdeAnios: 100, puntos: 4 },
    { desdeAnios: 200, puntos: 7 },
    { desdeAnios: 300, puntos: 10 },
  ],
  multiplicadores: {
    IMAGEN: 1.5,
    RETABLO_PINTURA_MURAL: 1.3,
    ORGANO_PIANO: 1.2,
    ORFEBRERIA_MOBILIARIO_DOCUMENTO: 1,
    OTRO: 0.8,
  },
  puntosInah: 5,
  distinciones: [
    { minimo: 40, nombre: 'Patrimonio sobresaliente' },
    { minimo: 20, nombre: 'Alto valor patrimonial' },
    { minimo: 8, nombre: 'Valor patrimonial' },
  ],
};

interface Calculable {
  tipo: TipoObjeto;
  anio: number | null;
  siglo: number | null;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
}

const decimas = (n: number) => Math.round(n * 10);

export const anioEfectivo = (o: { anio: number | null; siglo: number | null }) =>
  o.anio ?? ((o.siglo ?? 1) - 1) * 100 + 50;

export const anioCalculo = () => new Date().getFullYear();

function decimasObjeto(o: Calculable, c: CriteriosIndice) {
  const edad = anioCalculo() - anioEfectivo(o);
  let puntos = 0;
  for (const r of c.rangosEdad) if (edad >= r.desdeAnios) puntos = r.puntos;
  const base = puntos * decimas(c.multiplicadores[GRUPO_DE_TIPO[o.tipo]]);
  return base + (o.catalogadoInah ? decimas(c.puntosInah) : 0);
}

export function puntosObjeto(o: Calculable, c: CriteriosIndice) {
  return o.estado === 'VIGENTE' ? decimasObjeto(o, c) / 10 : 0;
}

export function indiceDe(objetos: Calculable[], c: CriteriosIndice) {
  const total = objetos
    .filter((o) => o.estado === 'VIGENTE')
    .reduce((s, o) => s + decimasObjeto(o, c), 0);
  return {
    indice: total / 10,
    distincion: c.distinciones.find((d) => total >= decimas(d.minimo))?.nombre ?? null,
  };
}

const ROMANOS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function epoca(o: { anio: number | null; siglo: number | null }) {
  if (o.anio !== null) return String(o.anio);
  let resto = o.siglo ?? 0;
  let texto = '';
  for (const [v, l] of ROMANOS)
    while (resto >= v) {
      texto += l;
      resto -= v;
    }
  return `siglo ${texto}`;
}
