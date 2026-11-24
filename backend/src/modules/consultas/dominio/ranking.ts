// Ranking de iglesias reconocidas (RF-19–RF-21, RN-12, RN-13). Función pura.

export interface CandidatoRanking {
  nombre: string;
  indice: number;
  objetosRegistrados: number;
  objetosVigentes: number;
}

/**
 * RN-13: fuera las que no tienen objetos registrados. Supuesto de P-07: tampoco entran las que
 * tienen objetos pero ninguno vigente (índice 0); sí entran las que no alcanzan distinción.
 */
export function entraAlRanking(c: CandidatoRanking): boolean {
  return c.objetosRegistrados > 0 && c.objetosVigentes > 0;
}

/** RN-12: de mayor a menor índice; los empates, por nombre (supuesto de P-07). */
export function ordenarRanking<T extends CandidatoRanking>(candidatos: T[]): T[] {
  return candidatos
    .filter(entraAlRanking)
    .sort((a, b) => b.indice - a.indice || a.nombre.localeCompare(b.nombre, 'es'));
}
