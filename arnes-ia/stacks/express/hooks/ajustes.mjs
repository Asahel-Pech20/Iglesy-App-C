// Ajustes del pre-commit por proyecto. Se leen de `arnes.config.json` en la raíz del repositorio;
// lo que falte toma el valor por defecto (proyecto con el código en `src/` y Vitest en la raíz).
import { existsSync, readFileSync } from 'node:fs';

export const ARCHIVO_AJUSTES = 'arnes.config.json';

export const AJUSTES_POR_DEFECTO = Object.freeze({
  dependencias: {
    // Carpetas a las que se aplican las reglas de arquitectura
    rutas: ['src'],
    config: 'arnes-ia/stacks/express/.dependency-cruiser.cjs',
    // Lista de violaciones heredadas (`depcruise … --output-type baseline`); null si no hay
    conocidas: null,
    // Expresiones regulares de lo que es acceso a datos (regla controller-sin-orm); null = Prisma.
    // La lee .dependency-cruiser.cjs; aquí solo se valida.
    accesoDatos: null,
  },
  pruebas: {
    // Carpeta desde la que corre Vitest y sus argumentos
    cwd: '.',
    args: ['run'],
  },
});

/** Mezcla el JSON del proyecto con los valores por defecto. Pura, para poder probarla. */
export function combinarAjustes(texto) {
  const base = AJUSTES_POR_DEFECTO;
  if (texto === null || texto === undefined) return structuredClone(base);
  let propios;
  try {
    propios = JSON.parse(texto);
  } catch {
    throw new Error(`${ARCHIVO_AJUSTES} no es JSON válido.`);
  }
  if (typeof propios !== 'object' || propios === null || Array.isArray(propios)) {
    throw new Error(`${ARCHIVO_AJUSTES} debe ser un objeto.`);
  }
  const ajustes = {
    dependencias: { ...base.dependencias, ...(propios.dependencias ?? {}) },
    pruebas: { ...base.pruebas, ...(propios.pruebas ?? {}) },
  };
  const { rutas } = ajustes.dependencias;
  if (!Array.isArray(rutas) || rutas.length === 0 || !rutas.every((r) => typeof r === 'string')) {
    throw new Error(`${ARCHIVO_AJUSTES}: dependencias.rutas debe ser una lista de carpetas.`);
  }
  const { accesoDatos } = ajustes.dependencias;
  if (accesoDatos !== null && (!Array.isArray(accesoDatos) || accesoDatos.length === 0)) {
    throw new Error(`${ARCHIVO_AJUSTES}: dependencias.accesoDatos debe ser una lista o null.`);
  }
  if (!Array.isArray(ajustes.pruebas.args)) {
    throw new Error(`${ARCHIVO_AJUSTES}: pruebas.args debe ser una lista.`);
  }
  return ajustes;
}

export function leerAjustes(raiz = '.') {
  const ruta = `${raiz}/${ARCHIVO_AJUSTES}`;
  return combinarAjustes(existsSync(ruta) ? readFileSync(ruta, 'utf8') : null);
}
