import { describe, expect, it } from 'vitest';
import { entraAlRanking, ordenarRanking } from './ranking';

const iglesia = (nombre: string, indice: number, registrados = 1, vigentes = registrados) => ({
  nombre,
  indice,
  objetosRegistrados: registrados,
  objetosVigentes: vigentes,
});

describe('ranking (RN-12, RN-13)', () => {
  it('CA-06: ordena de mayor a menor índice y deja fuera a la que no tiene objetos', () => {
    const ranking = ordenarRanking([
      iglesia('Parroquia del ejemplo', 35.5),
      iglesia('Iglesia D', 0, 0),
      iglesia('Iglesia A', 45),
    ]);
    expect(ranking.map((i) => i.nombre)).toEqual(['Iglesia A', 'Parroquia del ejemplo']);
  });

  it('P-07 (supuesto): sin objetos vigentes no entra; sin distinción sí', () => {
    expect(entraAlRanking(iglesia('Todo prestado', 0, 3, 0))).toBe(false);
    expect(entraAlRanking(iglesia('Poco valor', 2))).toBe(true);
  });

  it('P-07 (supuesto): los empates se ordenan por nombre', () => {
    const ranking = ordenarRanking([iglesia('Zapotitlán', 10), iglesia('Ávila', 10)]);
    expect(ranking.map((i) => i.nombre)).toEqual(['Ávila', 'Zapotitlán']);
  });
});
