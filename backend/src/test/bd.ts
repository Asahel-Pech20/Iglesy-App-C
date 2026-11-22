// Cliente de Prisma de las PRUEBAS (E1-06, ADR-0007): sin alcance por iglesia, para preparar y
// revisar datos de cualquier iglesia. Las peticiones HTTP de las pruebas sí pasan por el cliente
// con alcance de `lib/prisma.ts` (lo fija `autenticar`). El código de `src/` nunca importa esto
// (regla de dependency-cruiser `produccion-sin-pruebas`).
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import { conIglesia } from '../lib/contextoIglesia';

const globalParaPruebas = globalThis as unknown as { prismaPruebas?: PrismaClient };

export const prisma =
  globalParaPruebas.prismaPruebas ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

globalParaPruebas.prismaPruebas = prisma;

/**
 * Iglesia de pruebas por omisión: la primera creada (la misma que usa `crearUsuario` para el
 * personal). Si no hay, la crea.
 */
export async function iglesiaDePrueba(): Promise<string> {
  const iglesia =
    (await prisma.iglesia.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })) ??
    (await prisma.iglesia.create({ data: { nombre: 'Iglesia de pruebas', tipo: 'PARROQUIA' } }));
  return iglesia.id;
}

/**
 * Para pruebas que llaman a un service directamente (sin petición HTTP, así que sin `autenticar`):
 * corre `fn` con la iglesia de pruebas como contexto. Sin esto, la gestión interna lanza.
 */
export async function enIglesiaDePrueba<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  return conIglesia(await iglesiaDePrueba(), fn);
}
