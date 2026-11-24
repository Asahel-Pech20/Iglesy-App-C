// Índice de valor patrimonial (RN-01 … RN-06, RN-16, ADR-0005). Función pura: sin BD ni reloj.
// Viene del módulo de referencia del arnés (E2-10); se agregan los 10 tipos de RN-16, su grupo y
// cómo se muestra la época de un objeto (RF-17). Se calcula en décimas enteras para que
// 7 × 1.3 + … no acumule error de punto flotante.

/** Tipos de objeto que captura el administrador (RN-16; lista cerrada mientras no responda P-06). */
export const TIPOS_OBJETO = [
  'IMAGEN',
  'RETABLO',
  'PINTURA',
  'MURAL',
  'ORGANO',
  'PIANO',
  'ORFEBRERIA',
  'MOBILIARIO_LITURGICO',
  'DOCUMENTO',
  'OTRO',
] as const;
export type TipoObjetoCaptura = (typeof TIPOS_OBJETO)[number];

/** Los cinco grupos del multiplicador (RN-03). */
export const GRUPOS_OBJETO = [
  'IMAGEN',
  'RETABLO_PINTURA_MURAL',
  'ORGANO_PIANO',
  'ORFEBRERIA_MOBILIARIO_DOCUMENTO',
  'OTRO',
] as const;
export type TipoObjeto = (typeof GRUPOS_OBJETO)[number];

/** RN-16: cada tipo pertenece a un grupo. Los candelabros se capturan como ORFEBRERIA. */
export const GRUPO_DE_TIPO: Record<TipoObjetoCaptura, TipoObjeto> = {
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

export const ESTADOS_OBJETO = ['VIGENTE', 'PERDIDO', 'PRESTADO', 'BAJA'] as const;
export type EstadoObjeto = (typeof ESTADOS_OBJETO)[number];
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

/** Objeto tal como se guarda (tipo de captura) → objeto del cálculo (grupo). */
export function aObjetoDelIndice(o: {
  tipo: TipoObjetoCaptura;
  anio: number | null;
  siglo: number | null;
  catalogadoInah: boolean;
  estado: EstadoObjeto;
}): ObjetoPatrimonial {
  return {
    tipo: GRUPO_DE_TIPO[o.tipo],
    ...(o.anio !== null && { anio: o.anio }),
    ...(o.siglo !== null && { siglo: o.siglo }),
    catalogadoInah: o.catalogadoInah,
    estado: o.estado,
  };
}

/** Antigüedad en años con el año de cálculo (RN-15). */
export function antiguedad(o: Pick<ObjetoPatrimonial, 'anio' | 'siglo'>, anioCalculo: number) {
  return anioCalculo - anioEfectivo(o);
}

const ROMANOS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 18 → «XVIII». */
export function romano(n: number): string {
  let resto = n;
  let texto = '';
  for (const [valor, letra] of ROMANOS)
    while (resto >= valor) {
      texto += letra;
      resto -= valor;
    }
  return texto;
}

/** RF-17: el año exacto, o «siglo XVIII» si solo se conoce el siglo. */
export function epoca(o: { anio: number | null; siglo: number | null }): string {
  if (o.anio !== null) return String(o.anio);
  if (o.siglo !== null) return `siglo ${romano(o.siglo)}`;
  return '';
}
