import { describe, expect, it } from 'vitest';
import { leerIglesiasReales } from '../../../prisma/seed-iglesias-reales';
import { conFoto } from './iglesias.service';

// Iglesias reales del seed (prisma/datos/iglesias-reales.json): Wikidata + Wikimedia Commons
describe('iglesias reales con foto (seed)', () => {
  const iglesias = leerIglesiasReales();

  it('hay al menos 5 en cada uno de los 32 estados', () => {
    const porEstado = new Map<string, number>();
    for (const i of iglesias) porEstado.set(i.estado, (porEstado.get(i.estado) ?? 0) + 1);
    expect(porEstado.size).toBe(32);
    for (const [estado, n] of porEstado) expect(n, `estado ${estado}`).toBeGreaterThanOrEqual(5);
  });

  it('cada una trae municipio del INEGI de su estado y una foto https con autor y licencia libre', () => {
    for (const i of iglesias) {
      expect(i.municipio, i.nombre).toMatch(/^\d{5}$/);
      expect(i.municipio.slice(0, 2), i.nombre).toBe(i.estado);
      // Commons sirve las miniaturas desde thumb.* y los originales desde upload.*
      expect(i.fotoUrl, i.nombre).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(i.fotoEnlace, i.nombre).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(i.fotoAutor.trim(), i.nombre).not.toBe('');
      expect(i.fotoLicencia, i.nombre).toMatch(/^(CC|Public domain|PD|No restrictions)/i);
    }
  });

  it('no hay nombres repetidos en el mismo municipio', () => {
    const claves = iglesias.map((i) => `${i.municipio}|${i.nombre}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe('foto de una iglesia en la respuesta', () => {
  it('las columnas se agrupan en `foto`; sin URL, `foto: null`', () => {
    const vacia = {
      fotoUrl: null,
      fotoAutor: null,
      fotoLicencia: null,
      fotoLicenciaUrl: null,
      fotoEnlace: null,
    };
    expect(conFoto({ id: 'x', ...vacia })).toEqual({ id: 'x', foto: null });
    expect(
      conFoto({
        id: 'y',
        ...vacia,
        fotoUrl: 'https://upload.wikimedia.org/a.jpg',
        fotoAutor: 'Ana',
        fotoLicencia: 'CC BY-SA 4.0',
      }),
    ).toEqual({
      id: 'y',
      foto: {
        url: 'https://upload.wikimedia.org/a.jpg',
        autor: 'Ana',
        licencia: 'CC BY-SA 4.0',
        licenciaUrl: null,
        enlace: null,
      },
    });
  });
});
