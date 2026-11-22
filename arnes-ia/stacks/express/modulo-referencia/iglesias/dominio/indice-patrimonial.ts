// Índice de valor patrimonial (RN-01 … RN-06, RNF-13). Función pura: sin BD ni reloj implícito.
// Se calcula en décimas de punto (enteros) para que 7 × 1.3 + … no acumule error de punto flotante.

export type TipoObjeto =
  | 'IMAGEN' // santos, vírgenes y cristos
  | 'RETABLO_PINTURA_MURAL'
  | 'ORGANO_PIANO'
  | 'ORFEBRERIA_MOBILIARIO_DOCUMENTO'
  | 'OTRO';

export type EstadoObjeto = 'VIGENTE' | 'PERDIDO' | 'PRESTADO' | 'BAJA';

export interface ObjetoPatrimonial {
  tipo: TipoObjeto;
  /** Año exacto, si se conoce. */
  anio?: number;
  /** Siglo (18 = siglo XVIII), si solo se conoce el siglo. */
  siglo?: number;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
}

/** Criterios ajustables por la Coordinación (se guardan como datos, RNF-13). */
export interface CriteriosIndice {
  /** Ordenados de menor a mayor: a partir de `desdeAnios` años vale `puntos`. */
  rangosEdad: { desdeAnios: number; puntos: number }[];
  multiplicadores: Record<TipoObjeto, number>;
  puntosInah: number;
  /** Ordenadas de mayor a menor mínimo. */
  distinciones: { minimo: number; nombre: string }[];
}

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

const decimas = (n: number) => Math.round(n * 10);

/** RN-02: si solo se conoce el siglo, cuenta la mitad del siglo («siglo XVIII» = 1750). */
export function anioEfectivo(objeto: Pick<ObjetoPatrimonial, 'anio' | 'siglo'>): number {
  if (objeto.anio !== undefined) return objeto.anio;
  if (objeto.siglo !== undefined) return (objeto.siglo - 1) * 100 + 50;
  throw new Error('El objeto necesita año o siglo.');
}

/** RN-01: puntos por antigüedad según los rangos vigentes. */
export function puntosPorEdad(edad: number, criterios = CRITERIOS_INICIALES): number {
  let puntos = 0;
  for (const rango of criterios.rangosEdad) if (edad >= rango.desdeAnios) puntos = rango.puntos;
  return puntos;
}

/** Puntos de un objeto en décimas: edad × multiplicador (RN-03) + INAH (RN-04). */
function decimasObjeto(o: ObjetoPatrimonial, anioCalculo: number, c: CriteriosIndice): number {
  const base = puntosPorEdad(anioCalculo - anioEfectivo(o), c) * decimas(c.multiplicadores[o.tipo]);
  return base + (o.catalogadoInah ? decimas(c.puntosInah) : 0);
}

export function puntosObjeto(
  objeto: ObjetoPatrimonial,
  anioCalculo: number,
  criterios = CRITERIOS_INICIALES,
): number {
  return decimasObjeto(objeto, anioCalculo, criterios) / 10;
}

/** RN-05 y RN-06: suma de objetos vigentes y distinción (null si no alcanza ninguna). */
export function indiceIglesia(
  objetos: ObjetoPatrimonial[],
  anioCalculo: number,
  criterios = CRITERIOS_INICIALES,
): { indice: number; distincion: string | null } {
  const total = objetos
    .filter((o) => o.estado === 'VIGENTE')
    .reduce((suma, o) => suma + decimasObjeto(o, anioCalculo, criterios), 0);
  const indice = total / 10;
  const distincion = criterios.distinciones.find((d) => total >= decimas(d.minimo))?.nombre ?? null;
  return { indice, distincion };
}
