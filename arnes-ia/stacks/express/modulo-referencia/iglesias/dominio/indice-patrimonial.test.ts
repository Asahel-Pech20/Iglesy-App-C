import { describe, expect, it } from 'vitest';
import {
  CRITERIOS_INICIALES,
  anioEfectivo,
  indiceIglesia,
  puntosObjeto,
  puntosPorEdad,
  type ObjetoPatrimonial,
} from './indice-patrimonial';

const objeto = (o: Partial<ObjetoPatrimonial>): ObjetoPatrimonial => ({
  tipo: 'ORFEBRERIA_MOBILIARIO_DOCUMENTO',
  anio: 2000,
  catalogadoInah: false,
  estado: 'VIGENTE',
  ...o,
});

describe('índice de valor patrimonial', () => {
  it('CA-01: la parroquia del ejemplo del cliente suma 35.5 y es Alto valor patrimonial', () => {
    // Dado los cuatro objetos del caso, calculado en 2026
    const objetos = [
      objeto({ tipo: 'IMAGEN', anio: 1720, catalogadoInah: true }), // San Miguel Arcángel: 10 × 1.5 + 5 = 20
      objeto({ tipo: 'RETABLO_PINTURA_MURAL', anio: undefined, siglo: 18 }), // 7 × 1.3 = 9.1
      objeto({ tipo: 'ORFEBRERIA_MOBILIARIO_DOCUMENTO', anio: 1890 }), // 4 × 1 = 4
      objeto({ tipo: 'ORGANO_PIANO', anio: 1950 }), // 2 × 1.2 = 2.4
    ];
    // Cuando se calcula / Entonces
    expect(indiceIglesia(objetos, 2026)).toEqual({
      indice: 35.5,
      distincion: 'Alto valor patrimonial',
    });
  });

  it('RN-01: respeta los límites de cada rango de edad', () => {
    expect([49, 50, 99, 100, 199, 200, 299, 300].map((e) => puntosPorEdad(e))).toEqual([
      1, 2, 2, 4, 4, 7, 7, 10,
    ]);
  });

  it('RN-02: «siglo XVIII» cuenta como 1750', () => {
    expect(anioEfectivo({ siglo: 18 })).toBe(1750);
    expect(anioEfectivo({ anio: 1801, siglo: 18 })).toBe(1801);
  });

  it('RN-03 y RN-04: multiplica por tipo y luego suma los puntos del INAH', () => {
    expect(puntosObjeto(objeto({ tipo: 'OTRO', anio: 1700, catalogadoInah: true }), 2026)).toBe(13);
  });

  it('RN-05: los objetos perdidos, prestados o dados de baja no cuentan', () => {
    const objetos = (['PERDIDO', 'PRESTADO', 'BAJA'] as const).map((estado) =>
      objeto({ tipo: 'IMAGEN', anio: 1600, estado }),
    );
    expect(indiceIglesia(objetos, 2026)).toEqual({ indice: 0, distincion: null });
  });

  it('RN-06: asigna la distinción en los límites exactos', () => {
    // Documentos de < 50 años valen 1 punto cada uno
    const conPuntos = (n: number) =>
      indiceIglesia(
        Array.from({ length: n }, () => objeto({})),
        2026,
      );
    expect(conPuntos(7).distincion).toBeNull();
    expect(conPuntos(8).distincion).toBe('Valor patrimonial');
    expect(conPuntos(20).distincion).toBe('Alto valor patrimonial');
    expect(conPuntos(40).distincion).toBe('Patrimonio sobresaliente');
  });

  it('RNF-13: los criterios se ajustan como datos, sin cambiar el código', () => {
    const criterios = { ...CRITERIOS_INICIALES, puntosInah: 10 };
    expect(puntosObjeto(objeto({ catalogadoInah: true }), 2026, criterios)).toBe(11);
  });
});
