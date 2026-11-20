import { afterAll, beforeEach, expect } from 'vitest';
import { correosEnviados } from '../lib/mailer';
import { prisma } from '../lib/prisma';

let tablas: string | null = null;

/** Vacía todas las tablas de la BD de pruebas (nunca la de desarrollo). */
export async function limpiarBd() {
  // Protección: el nombre de la BD debe terminar en _test (nunca se vacía la de desarrollo)
  const nombreBd = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!nombreBd.endsWith('_test')) {
    throw new Error(
      `Las pruebas solo pueden usar una BD cuyo nombre termine en _test (recibí "${nombreBd}").`,
    );
  }
  tablas ??= (
    await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  )
    .map((t) => `"${t.tablename}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas} RESTART IDENTITY CASCADE`);
}

/**
 * Las pruebas de `dominio/` son funciones puras (regla `dominio-puro` del arnés): no usan la BD,
 * así que no se vacía antes de cada una. Antes lo hacía y causaba timeouts (A2-E1-05).
 */
export function usaBd(rutaPrueba: string | undefined): boolean {
  return !/[\\/]dominio[\\/]/.test(rutaPrueba ?? '');
}

beforeEach(async () => {
  if (usaBd(expect.getState().testPath)) await limpiarBd();
  correosEnviados.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});
