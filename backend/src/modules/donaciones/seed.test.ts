// Seed de aportaciones (B4): reproducible, idempotente y sin aportaciones futuras
import { describe, expect, it } from 'vitest';
import { seedB2 } from '../../../prisma/seed-b2';
import { seedDonaciones } from '../../../prisma/seed-b4';
import { sinAlcance } from '../../lib/contextoIglesia';
import { iglesiaDePrueba, prisma } from '../../test/bd';
import { crearUsuario } from '../../test/helpers';
import { hoyIglesia } from '../miembros/miembros.service';

describe('seed de aportaciones (B4)', () => {
  it('crea 12 meses de aportaciones, anónimas e identificadas, sin repetir al volver a correrlo', async () => {
    await crearUsuario('TESORERO', { email: 'tesorero@iglesia.local' });
    await prisma.configuracionIglesia.create({ data: { id: 1, nombre: 'Iglesia de prueba' } });
    const iglesiaId = await iglesiaDePrueba();
    const { miembroIds } = await sinAlcance('seed', () => seedB2(iglesiaId));

    const total = await sinAlcance('seed', () => seedDonaciones(miembroIds, iglesiaId));
    expect(total).toBeGreaterThan(100);
    expect(await prisma.donacion.count()).toBe(total);
    expect(
      await prisma.donacion.count({ where: { anonima: true, miembroId: null } }),
    ).toBeGreaterThan(0);
    expect(await prisma.donacion.count({ where: { anonima: false } })).toBeGreaterThan(0);
    // Ninguna incoherente (anónima con donante) ni futura
    expect(
      await prisma.donacion.count({ where: { anonima: true, NOT: { miembroId: null } } }),
    ).toBe(0);
    const ultima = await prisma.donacion.findFirst({ orderBy: { fecha: 'desc' } });
    expect(ultima!.fecha.toISOString().slice(0, 10) <= (await hoyIglesia())).toBe(true);

    const antes = await prisma.donacion.findMany({ orderBy: { id: 'asc' } });
    expect(await sinAlcance('seed', () => seedDonaciones(miembroIds, iglesiaId))).toBe(total);
    const despues = await prisma.donacion.findMany({ orderBy: { id: 'asc' } });
    expect(despues.map(({ updatedAt: _u, ...d }) => d)).toEqual(
      antes.map(({ updatedAt: _u, ...d }) => d),
    );
  });
});
