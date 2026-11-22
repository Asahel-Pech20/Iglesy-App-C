// B2-12: el seed de miembros y ministerios es reproducible e idempotente
import { describe, expect, it } from 'vitest';
import { seedB2 } from '../../../prisma/seed-b2';
import { sinAlcance } from '../../lib/contextoIglesia';
import { iglesiaDePrueba, prisma } from '../../test/bd';
import { crearUsuario } from '../../test/helpers';

/** Las semillas corren sin alcance por iglesia (como en prisma/seed.ts), en la iglesia de pruebas. */
async function sembrar() {
  const iglesiaId = await iglesiaDePrueba();
  return sinAlcance('seed', () => seedB2(iglesiaId));
}

describe('seed de miembros y ministerios (B2-12)', () => {
  it('crea 60 miembros (10 % inactivos), 6 ministerios, vínculos y coordinadores', async () => {
    await crearUsuario('COORDINADOR', { email: 'coordinador@iglesia.local' });
    const { miembroIds } = await sembrar();

    expect(miembroIds).toHaveLength(60);
    expect(await prisma.miembro.count({ where: { activo: false } })).toBe(6);
    expect(await prisma.ministerio.count()).toBe(6);
    expect(await prisma.miembroMinisterio.count()).toBeGreaterThan(20);
    expect(await prisma.ministerioCoordinador.count()).toBe(2);
    // Los inactivos no quedan vinculados
    expect(await prisma.miembroMinisterio.count({ where: { miembro: { activo: false } } })).toBe(0);
  });

  it('volver a correrlo no duplica y genera los mismos datos', async () => {
    const primera = await sembrar();
    const antes = await prisma.miembro.findMany({ orderBy: { id: 'asc' } });
    const vinculos = await prisma.miembroMinisterio.count();

    const segunda = await sembrar();
    expect(segunda.miembroIds).toEqual(primera.miembroIds);
    expect(await prisma.miembroMinisterio.count()).toBe(vinculos);
    const despues = await prisma.miembro.findMany({ orderBy: { id: 'asc' } });
    expect(despues.map(({ updatedAt: _u, ...m }) => m)).toEqual(
      antes.map(({ updatedAt: _u, ...m }) => m),
    );
  });
});
