// OSC-08: toda ruta que registra Express debe estar documentada en openapi.yaml.
// De ese archivo sale la colección de Postman, así que una ruta sin documentar queda fuera de ella.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { crearModulos } from './routes';

/**
 * Rutas que existen en Express pero todavía no están en openapi.yaml.
 * No se documentan por quien no es su dueño: cada una lleva «pendiente de <integrante>» y se borra
 * de aquí al documentarla (la última prueba avisa si queda una que ya está documentada).
 * Formato de la clave: `MÉTODO /ruta/{param}`.
 */
const SIN_DOCUMENTAR: Record<string, string> = {};

/** Se registra en `crearApiRouter`, no en un módulo. */
const FUERA_DE_MODULOS = new Set(['GET /health']);

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

interface CapaRuta {
  route?: { path: string; methods: Record<string, boolean> };
}

const aOpenApi = (ruta: string) => ruta.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

function rutasDeExpress() {
  const claves = new Set<string>();
  for (const { prefijo, router } of crearModulos()) {
    for (const capa of router.stack as CapaRuta[]) {
      if (!capa.route) continue;
      const ruta = aOpenApi(prefijo + (capa.route.path === '/' ? '' : capa.route.path));
      for (const metodo of Object.keys(capa.route.methods)) {
        claves.add(`${metodo.toUpperCase()} ${ruta}`);
      }
    }
  }
  return claves;
}

function rutasDeOpenApi() {
  const doc = parse(readFileSync(resolve(__dirname, '../openapi.yaml'), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const claves = new Set<string>();
  for (const [ruta, operaciones] of Object.entries(doc.paths)) {
    for (const metodo of Object.keys(operaciones)) {
      if (METODOS.includes(metodo)) claves.add(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
  return claves;
}

describe('cobertura de openapi.yaml (OSC-08)', () => {
  const express = rutasDeExpress();
  const documentadas = rutasDeOpenApi();

  it('encuentra las rutas de Express y las del YAML', () => {
    expect(express.size).toBeGreaterThan(15);
    expect(documentadas.size).toBeGreaterThan(15);
  });

  it('toda ruta de Express está en openapi.yaml', () => {
    const faltan = [...express]
      .filter((clave) => !documentadas.has(clave) && !(clave in SIN_DOCUMENTAR))
      .sort();
    expect(
      faltan,
      `Rutas sin documentar en backend/openapi.yaml (documéntalas, o agrégalas a SIN_DOCUMENTAR con su dueño):\n${faltan.join('\n')}`,
    ).toEqual([]);
  });

  it('openapi.yaml no documenta rutas que Express ya no tiene', () => {
    const sobran = [...documentadas]
      .filter((clave) => !express.has(clave) && !FUERA_DE_MODULOS.has(clave))
      .sort();
    expect(sobran, `Rutas documentadas que no existen:\n${sobran.join('\n')}`).toEqual([]);
  });

  it('la lista de excepciones solo tiene rutas reales, aún sin documentar y con dueño', () => {
    for (const [clave, nota] of Object.entries(SIN_DOCUMENTAR)) {
      expect(express, `${clave} ya no existe en Express`).toContain(clave);
      expect(documentadas.has(clave), `${clave} ya está documentada: quítala de la lista`).toBe(
        false,
      );
      expect(nota, `${clave} necesita «pendiente de <integrante>»`).toMatch(/^pendiente de \S/);
    }
  });
});
