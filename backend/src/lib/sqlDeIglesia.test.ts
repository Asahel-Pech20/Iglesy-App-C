// E1-06 (ADR-0007): el SQL crudo de la gestión interna siempre lleva la iglesia del contexto
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { prisma as bd } from '../test/bd';
import { crearIglesia } from '../test/helpers';
import { conIglesia, SinContextoDeIglesia } from './contextoIglesia';
import { consultarDeIglesia, exigirMismaIglesia } from './prisma';

describe('consultarDeIglesia (E1-06)', () => {
  it('pasa la iglesia del contexto como parámetro y filtra con ella', async () => {
    const [a, b] = [await crearIglesia(), await crearIglesia()];
    for (const iglesiaId of [a.id, b.id]) {
      await bd.miembro.create({
        data: { nombre: 'X', apellidos: 'Y', fechaIngreso: new Date(), iglesiaId },
      });
    }
    const filas = await conIglesia(a.id, () =>
      consultarDeIglesia<{ iglesiaId: string }[]>(
        (iglesiaId) =>
          Prisma.sql`SELECT "iglesiaId" FROM miembros WHERE "iglesiaId" = ${iglesiaId}`,
      ),
    );
    expect(filas).toEqual([{ iglesiaId: a.id }]);
  });

  it('lanza ANTES de ejecutar si la consulta no usa la iglesia', async () => {
    const { id } = await crearIglesia();
    await expect(
      conIglesia(id, () => consultarDeIglesia(() => Prisma.sql`SELECT id FROM miembros`)),
    ).rejects.toThrow(/no usa la iglesia/);
  });

  it('sin contexto de iglesia lanza', async () => {
    await expect(
      consultarDeIglesia((iglesiaId) => Prisma.sql`SELECT ${iglesiaId}`),
    ).rejects.toBeInstanceOf(SinContextoDeIglesia);
  });
});

describe('exigirMismaIglesia (E1-06)', () => {
  it('un id de otra iglesia → 422 con el campo; los inexistentes y los propios pasan', async () => {
    const [a, b] = [await crearIglesia(), await crearIglesia()];
    const fechaIngreso = new Date();
    const propio = await bd.miembro.create({
      data: { nombre: 'P', apellidos: 'P', fechaIngreso, iglesiaId: a.id },
    });
    const ajeno = await bd.miembro.create({
      data: { nombre: 'A', apellidos: 'A', fechaIngreso, iglesiaId: b.id },
    });
    await conIglesia(a.id, async () => {
      await expect(
        exigirMismaIglesia('miembro', [propio.id, 'no-existe', null], 'miembroIds'),
      ).resolves.toBeUndefined();
      await expect(
        exigirMismaIglesia('miembro', [propio.id, ajeno.id], 'miembroIds'),
      ).rejects.toMatchObject({
        status: 422,
        details: [{ campo: 'miembroIds', mensaje: `${ajeno.id} es de otra iglesia.` }],
      });
    });
  });
});

describe('ningún SQL crudo de modules/ se salta el helper (E1-06, ADR-0007)', () => {
  it('cada $queryRaw/$executeRaw de modules/ va marcado con «// sql-sin-iglesia: <motivo>»', () => {
    const sinMotivo: string[] = [];
    const archivos = readdirSync('src/modules', { recursive: true, encoding: 'utf8' })
      .map((r) => path.join('src/modules', r).split(path.sep).join('/'))
      .filter((r) => r.endsWith('.ts') && !r.endsWith('.test.ts'));
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        if (!/\$(queryRaw|executeRaw)(Unsafe)?\b/.test(linea)) return;
        const previa = lineas[i - 1] ?? '';
        if (!/\/\/ sql-sin-iglesia: \S/.test(previa)) sinMotivo.push(`${archivo}:${i + 1}`);
      });
    }
    // La gestión interna usa consultarDeIglesia / ejecutarDeIglesia (lib/prisma.ts)
    expect(sinMotivo).toEqual([]);
  });
});
