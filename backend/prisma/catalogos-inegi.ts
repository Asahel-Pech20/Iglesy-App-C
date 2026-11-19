// E2-05 (Nataly): carga el catálogo oficial del INEGI desde su archivo CSV (RF-10, RNF-05).
// Uso:  pnpm --filter backend db:catalogos <archivo.csv> [--localidades]
// El archivo se descarga del INEGI y NO se sube al repositorio. Se leen las columnas CVE_ENT, NOM_ENT,
// CVE_MUN, NOM_MUN, CVE_LOC y NOM_LOC (en cualquier orden). Sin --localidades se cargan solo estados
// y municipios. Es idempotente: volver a correrlo solo actualiza los nombres que cambiaron.
import { readFileSync } from 'node:fs';
import {
  esquemaFilaCatalogo,
  MAX_FILAS_IMPORTACION,
} from '../src/modules/catalogos/catalogos.schemas';
import { importar } from '../src/modules/catalogos/catalogos.service';
import { prisma } from '../src/lib/prisma';

/** CSV con comillas dobles (los nombres pueden llevar comas). */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      if (fila.some((v) => v !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((v) => v !== '')) filas.push(fila);
  return filas;
}

/** El INEGI publica en UTF-8 o en Latin-1 según el producto: se prueba UTF-8 y si falla, Latin-1. */
function decodificar(bytes: Buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

async function main() {
  const archivo = process.argv[2];
  const conLocalidades = process.argv.includes('--localidades');
  if (!archivo)
    throw new Error('Indica el archivo: pnpm --filter backend db:catalogos <archivo.csv>');

  const [encabezado, ...datos] = leerCsv(decodificar(readFileSync(archivo)));
  if (!encabezado) throw new Error('El archivo está vacío.');
  const columna = (nombre: string) =>
    encabezado.findIndex((h) => h.trim().toUpperCase() === nombre);
  const idx = {
    cveEnt: columna('CVE_ENT'),
    nomEnt: columna('NOM_ENT'),
    cveMun: columna('CVE_MUN'),
    nomMun: columna('NOM_MUN'),
    cveLoc: columna('CVE_LOC'),
    nomLoc: columna('NOM_LOC'),
  };
  if (idx.cveEnt < 0 || idx.nomEnt < 0) throw new Error('Faltan las columnas CVE_ENT y NOM_ENT.');

  const valor = (fila: string[], i: number) =>
    i >= 0 && fila[i]?.trim() ? fila[i].trim() : undefined;
  const filas = datos.map((fila, n) => {
    const cveMun = valor(fila, idx.cveMun);
    const cveLoc = conLocalidades ? valor(fila, idx.cveLoc) : undefined;
    const resultado = esquemaFilaCatalogo.safeParse({
      cveEnt: valor(fila, idx.cveEnt)?.padStart(2, '0'),
      nomEnt: valor(fila, idx.nomEnt),
      ...(cveMun && { cveMun: cveMun.padStart(3, '0'), nomMun: valor(fila, idx.nomMun) }),
      ...(cveLoc && { cveLoc: cveLoc.padStart(4, '0'), nomLoc: valor(fila, idx.nomLoc) }),
    });
    if (!resultado.success)
      throw new Error(`Fila ${n + 2}: ${resultado.error.issues.map((i) => i.message).join(' ')}`);
    return resultado.data;
  });

  // Por bloques: cada bloque es una transacción; los estados van primero porque el archivo está ordenado
  const total = { estados: 0, municipios: 0, localidades: 0 };
  for (let i = 0; i < filas.length; i += MAX_FILAS_IMPORTACION) {
    const { cambiadas } = await importar(filas.slice(i, i + MAX_FILAS_IMPORTACION));
    total.estados += cambiadas.estados;
    total.municipios += cambiadas.municipios;
    total.localidades += cambiadas.localidades;
  }
  const [estados, municipios, localidades] = await Promise.all([
    prisma.estado.count(),
    prisma.municipio.count(),
    prisma.localidad.count(),
  ]);
  // Resumen al terminar (mismo criterio que seed.ts: console.warn)
  console.warn(
    `Catálogo INEGI: ${estados} estados, ${municipios} municipios y ${localidades} localidades ` +
      `(insertados o renombrados: ${total.estados}, ${total.municipios} y ${total.localidades}).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
