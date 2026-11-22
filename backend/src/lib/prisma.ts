import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { limitarAIglesia, tieneAlcance } from './alcancePrisma';
import { AppError } from './appError';
import { contextoActual, iglesiaDelContexto, SinContextoDeIglesia } from './contextoIglesia';

// Cliente singleton: evita abrir conexiones nuevas en cada recarga de tsx watch
const globalParaPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

const base =
  globalParaPrisma.prismaBase ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

if (env.NODE_ENV !== 'production') globalParaPrisma.prismaBase = base;

/**
 * Cliente de Prisma con alcance por iglesia (E1-06, ADR-0007). En los modelos de la gestión
 * interna (`MODELOS_CON_IGLESIA` y `MODELOS_POR_RELACION`):
 * - con contexto de iglesia (lo fija `autenticar`) solo ve y crea filas de esa iglesia;
 * - sin contexto, o con el de la Coordinación, LANZA `SinContextoDeIglesia` (500): nunca devuelve
 *   datos de todas las iglesias por descuido;
 * - con `sinAlcance(motivo, …)` (Coordinación, semillas y scripts) no filtra.
 * Los demás modelos (usuarios, iglesias, catálogos, diezmo, espacios…) no cambian: ya se limitan
 * con `alcanceIglesia` en sus rutas.
 */
export const prisma = base.$extends({
  name: 'alcance-por-iglesia',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!tieneAlcance(model)) return query(args);
        const contexto = contextoActual();
        if (contexto?.tipo === 'sinAlcance') return query(args);
        if (contexto?.tipo !== 'iglesia') {
          throw new SinContextoDeIglesia(
            model,
            contexto ? 'la Coordinación no tiene gestión interna' : 'no hay contexto',
          );
        }
        return query(
          limitarAIglesia(model, operation, args as Record<string, unknown>, contexto.iglesiaId),
        );
      },
    },
  },
});

/**
 * Cliente de una transacción del cliente con alcance (`prisma.$transaction(async (tx) => …)`).
 * No es `Prisma.TransactionClient`: ese es el del cliente sin extender y TypeScript no los mezcla.
 */
export type TransaccionPrisma = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Cliente de Prisma (con alcance) o el de una transacción suya. */
export type ClientePrisma = typeof prisma | TransaccionPrisma;

/**
 * SQL crudo de la gestión interna (ADR-0007): `armar` recibe la iglesia del contexto y DEBE usarla
 * como parámetro (`${iglesiaId}`); si no aparece en los valores de la consulta, lanza antes de
 * ejecutarla. `sqlDeIglesia.test.ts` revisa que ningún `$queryRaw`/`$executeRaw` de `modules/`
 * se salte este helper (salvo los marcados `// sql-sin-iglesia: <motivo>`).
 * @example await consultarDeIglesia<{ id: string }[]>((iglesiaId) => Prisma.sql`
 *   SELECT id FROM miembros WHERE "iglesiaId" = ${iglesiaId} AND …`)
 */
export async function consultarDeIglesia<T>(
  armar: (iglesiaId: string) => Prisma.Sql,
  cliente: ClientePrisma = prisma,
): Promise<T> {
  return cliente.$queryRaw<T>(sqlVerificado(armar));
}

/** Igual que `consultarDeIglesia`, para `UPDATE`/`INSERT`; devuelve las filas afectadas. */
export async function ejecutarDeIglesia(
  armar: (iglesiaId: string) => Prisma.Sql,
  cliente: ClientePrisma = prisma,
): Promise<number> {
  return cliente.$executeRaw(sqlVerificado(armar));
}

const TABLAS_CON_IGLESIA = {
  miembro: { tabla: 'miembros', nombre: 'miembros' },
  ministerio: { tabla: 'ministerios', nombre: 'ministerios' },
  evento: { tabla: 'eventos', nombre: 'eventos' },
  usuario: { tabla: 'usuarios', nombre: 'usuarios' },
} as const;

/**
 * Vínculos entre iglesias (E1-06, ADR-0007): las tablas puente (asistencia, integrantes,
 * responsables, coordinadores) y las llaves como `Evento.ministerioId` deben unir filas de la MISMA
 * iglesia. Con el filtro, un id de otra iglesia parecería no existir (404); aquí se distingue y
 * responde 422. Solo revela que el id existe en otra iglesia, nunca sus datos.
 * Va antes de la búsqueda normal del service; los ids que no existen siguen su camino (404).
 */
export async function exigirMismaIglesia(
  modelo: keyof typeof TABLAS_CON_IGLESIA,
  ids: readonly (string | null | undefined)[],
  campo: string,
  cliente: ClientePrisma = prisma,
): Promise<void> {
  const validos = ids.filter((id): id is string => typeof id === 'string' && id !== '');
  if (validos.length === 0) return;
  const { tabla, nombre } = TABLAS_CON_IGLESIA[modelo];
  const iglesiaId = iglesiaDelContexto(`vínculo con ${nombre}`);
  // Identificador fijo de la lista de arriba, nunca texto del usuario
  const ajenos = await cliente.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM ${Prisma.raw(`"${tabla}"`)}
    WHERE id IN (${Prisma.join(validos)}) AND "iglesiaId" IS DISTINCT FROM ${iglesiaId}`);
  if (ajenos.length > 0) {
    throw new AppError(
      'BUSINESS_RULE',
      `No se pueden vincular ${nombre} de otra iglesia.`,
      422,
      ajenos.map((f) => ({ campo, mensaje: `${f.id} es de otra iglesia.` })),
    );
  }
}

function sqlVerificado(armar: (iglesiaId: string) => Prisma.Sql): Prisma.Sql {
  const iglesiaId = iglesiaDelContexto('SQL crudo');
  const sql = armar(iglesiaId);
  if (!sql.values.includes(iglesiaId)) {
    throw new SinContextoDeIglesia('SQL crudo', 'la consulta no usa la iglesia del contexto');
  }
  return sql;
}
