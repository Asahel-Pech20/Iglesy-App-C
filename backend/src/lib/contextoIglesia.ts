// Contexto de iglesia de cada petición (E1-06, ADR-0007). Lo fija `autenticar` con la iglesia del
// usuario (leída de la BD) y lo lee la extensión de Prisma de `lib/prisma.ts` para filtrar la
// gestión interna. Nunca se arma con una iglesiaId que mande el cliente.
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Quién puede consultar la gestión interna de todas las iglesias a la vez, y por qué. Lista cerrada:
 * `contextoIglesia.test.ts` revisa que solo estos archivos llamen a `sinAlcance`.
 */
export type MotivoSinAlcance =
  /** La Coordinación (nacional, sin iglesia) en las pocas tareas que cruzan iglesias. */
  | 'coordinacion'
  /** Semillas de `prisma/seed*.ts`: cargan datos de varias iglesias. */
  | 'seed'
  /** Scripts de mantenimiento de `scripts/`. */
  | 'script';

export type ContextoIglesia =
  | { tipo: 'iglesia'; iglesiaId: string }
  /** Usuario nacional (Coordinación): no tiene gestión interna propia. */
  | { tipo: 'nacional' }
  | { tipo: 'sinAlcance'; motivo: MotivoSinAlcance };

const almacen = new AsyncLocalStorage<ContextoIglesia>();

/** Error de programación: una consulta de gestión interna sin iglesia. Responde 500. */
export class SinContextoDeIglesia extends Error {
  constructor(modelo: string, detalle: string) {
    super(`Consulta de ${modelo} sin contexto de iglesia: ${detalle}`);
    this.name = 'SinContextoDeIglesia';
  }
}

/**
 * Las consultas de Prisma son perezosas: se ejecutan al hacerles `await`, no al crearlas. Por eso
 * se espera el resultado DENTRO del contexto; si no, `conIglesia(id, () => prisma.miembro.count())`
 * correría la consulta fuera de él.
 */
function ejecutarEn<T>(contexto: ContextoIglesia, fn: () => T | PromiseLike<T>): Promise<T> {
  return almacen.run(contexto, async () => await fn());
}

/** Ejecuta `fn` con la gestión interna limitada a esa iglesia. */
export function conIglesia<T>(iglesiaId: string, fn: () => T | PromiseLike<T>): Promise<T> {
  return ejecutarEn({ tipo: 'iglesia', iglesiaId }, fn);
}

/**
 * Ejecuta `fn` SIN filtro de iglesia. Solo para la Coordinación, las semillas y los scripts
 * (ver `MotivoSinAlcance`); en una ruta de iglesia nunca.
 */
export function sinAlcance<T>(motivo: MotivoSinAlcance, fn: () => T | PromiseLike<T>): Promise<T> {
  return ejecutarEn({ tipo: 'sinAlcance', motivo }, fn);
}

/**
 * Para el middleware `autenticar`: corre el resto de la petición (`next`) con la iglesia del usuario,
 * o como nacional si no tiene (la Coordinación, cuya gestión interna lanza `SinContextoDeIglesia`).
 */
export function continuarConIglesiaDe(iglesiaId: string | null, next: () => void): void {
  almacen.run(iglesiaId ? { tipo: 'iglesia', iglesiaId } : { tipo: 'nacional' }, next);
}

/** Contexto vigente, o undefined si nadie lo fijó. */
export function contextoActual(): ContextoIglesia | undefined {
  return almacen.getStore();
}

/** Iglesia del contexto vigente; lanza si no hay una (nacional, sin alcance o sin contexto). */
export function iglesiaDelContexto(uso = 'SQL'): string {
  const contexto = almacen.getStore();
  if (contexto?.tipo !== 'iglesia') {
    throw new SinContextoDeIglesia(uso, contexto ? `contexto ${contexto.tipo}` : 'no hay contexto');
  }
  return contexto.iglesiaId;
}
