// Filtro por iglesia de la gestión interna (E1-06, ADR-0007). Funciones puras: reescriben los
// argumentos de una consulta de Prisma para que solo toque filas de una iglesia. Las usa la
// extensión de `lib/prisma.ts`; aquí se prueban sin BD.

/** Modelos con columna `iglesiaId`: se filtran y, al crear, se les pone la iglesia del contexto. */
export const MODELOS_CON_IGLESIA = [
  'Miembro',
  'Ministerio',
  'Evento',
  'Anuncio',
  'Donacion',
  'HorarioReunion',
] as const;

/**
 * Modelos sin columna propia: la iglesia sale de un extremo. Se filtran por esa relación; al crear,
 * el service exige que ambos extremos sean de la misma iglesia (422).
 */
export const MODELOS_POR_RELACION = {
  Asistencia: 'evento',
  EventoResponsable: 'evento',
  MiembroMinisterio: 'ministerio',
  MinisterioCoordinador: 'ministerio',
} as const;

export type ModeloConAlcance =
  (typeof MODELOS_CON_IGLESIA)[number] | keyof typeof MODELOS_POR_RELACION;

const CON_IGLESIA = new Set<string>(MODELOS_CON_IGLESIA);

export function tieneAlcance(modelo: string | undefined): modelo is ModeloConAlcance {
  return modelo !== undefined && (CON_IGLESIA.has(modelo) || modelo in MODELOS_POR_RELACION);
}

/** Operaciones cuyo `where` acepta cualquier filtro: se combina con AND. */
const CON_WHERE = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);
/** Operaciones con `where` único: Prisma admite filtros extra junto a la llave. */
const CON_WHERE_UNICO = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);
const CREAN = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

type Args = Record<string, unknown>;

function filtro(modelo: ModeloConAlcance, iglesiaId: string): Args {
  if (CON_IGLESIA.has(modelo)) return { iglesiaId };
  const relacion = MODELOS_POR_RELACION[modelo as keyof typeof MODELOS_POR_RELACION];
  return { [relacion]: { iglesiaId } };
}

function conIglesia(datos: unknown, iglesiaId: string): unknown {
  if (Array.isArray(datos)) return datos.map((d) => conIglesia(d, iglesiaId));
  // Siempre se sobrescribe: una iglesiaId que venga en los datos nunca gana a la del contexto
  return { ...(datos as Args), iglesiaId };
}

/**
 * Devuelve los argumentos limitados a `iglesiaId`. No muta `args`.
 * - Lecturas, `updateMany` y `deleteMany`: `where: { AND: [where, { iglesiaId }] }`.
 * - Con llave única (`findUnique`, `update`, `delete`, `upsert`): agrega el filtro junto a la llave,
 *   así una fila de otra iglesia se comporta como si no existiera (404 / P2025).
 * - Creación en modelos con columna: pone `iglesiaId` del contexto.
 * Las tablas puente no reciben `iglesiaId` al crear: no tienen la columna.
 */
export function limitarAIglesia(
  modelo: ModeloConAlcance,
  operacion: string,
  args: Args | undefined,
  iglesiaId: string,
): Args {
  const nuevos: Args = { ...(args ?? {}) };
  const f = filtro(modelo, iglesiaId);
  if (CON_WHERE.has(operacion)) {
    nuevos['where'] = nuevos['where'] ? { AND: [nuevos['where'], f] } : f;
  } else if (CON_WHERE_UNICO.has(operacion)) {
    nuevos['where'] = { ...(nuevos['where'] as Args), ...f };
  } else if (!CREAN.has(operacion)) {
    // Una operación nueva de Prisma que no conocemos: mejor fallar que dejarla sin filtro
    throw new Error(`Operación ${operacion} de ${modelo} sin regla de alcance por iglesia.`);
  }
  if (CREAN.has(operacion) && CON_IGLESIA.has(modelo)) {
    const campo = operacion === 'upsert' ? 'create' : 'data';
    nuevos[campo] = conIglesia(nuevos[campo], iglesiaId);
  }
  return nuevos;
}
