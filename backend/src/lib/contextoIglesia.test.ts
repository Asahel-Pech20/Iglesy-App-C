// E1-06 (ADR-0007): el cliente de Prisma con alcance por iglesia, contra la BD de pruebas
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prisma as bd } from '../test/bd';
import { crearIglesia } from '../test/helpers';
import { conIglesia, SinContextoDeIglesia, sinAlcance } from './contextoIglesia';
import { prisma } from './prisma';

async function dosIglesiasConMiembros() {
  const [a, b] = [await crearIglesia({ nombre: 'A' }), await crearIglesia({ nombre: 'B' })];
  const fechaIngreso = new Date('2025-01-01');
  const ana = await bd.miembro.create({
    data: { nombre: 'Ana', apellidos: 'A', fechaIngreso, iglesiaId: a.id },
  });
  const beto = await bd.miembro.create({
    data: { nombre: 'Beto', apellidos: 'B', fechaIngreso, iglesiaId: b.id },
  });
  return { a: a.id, b: b.id, ana, beto };
}

describe('cliente con alcance por iglesia (E1-06)', () => {
  it('sin contexto LANZA: nunca devuelve la gestión interna de todas las iglesias', async () => {
    await dosIglesiasConMiembros();
    await expect(prisma.miembro.findMany()).rejects.toBeInstanceOf(SinContextoDeIglesia);
    await expect(prisma.asistencia.count()).rejects.toBeInstanceOf(SinContextoDeIglesia);
  });

  it('los modelos que no son de gestión interna no cambian sin contexto', async () => {
    await crearIglesia();
    expect(await prisma.iglesia.count()).toBe(1);
  });

  it('con contexto solo ve y toca filas de esa iglesia', async () => {
    const { a, ana, beto } = await dosIglesiasConMiembros();
    await conIglesia(a, async () => {
      expect((await prisma.miembro.findMany()).map((m) => m.nombre)).toEqual(['Ana']);
      expect(await prisma.miembro.findUnique({ where: { id: beto.id } })).toBeNull();
      await expect(
        prisma.miembro.update({ where: { id: beto.id }, data: { notas: 'x' } }),
      ).rejects.toThrow();
      expect(await prisma.miembro.count({ where: { id: { in: [ana.id, beto.id] } } })).toBe(1);
    });
    expect((await bd.miembro.findUniqueOrThrow({ where: { id: beto.id } })).notas).toBeNull();
  });

  it('al crear usa la iglesia del contexto aunque los datos digan otra', async () => {
    const { a, b } = await dosIglesiasConMiembros();
    const creado = await conIglesia(a, () =>
      prisma.miembro.create({
        data: { nombre: 'Caro', apellidos: 'C', fechaIngreso: new Date(), iglesiaId: b },
      }),
    );
    expect(creado.iglesiaId).toBe(a);
  });

  it('conIglesia espera la consulta dentro del contexto (las de Prisma son perezosas)', async () => {
    const { a } = await dosIglesiasConMiembros();
    expect(await conIglesia(a, () => prisma.miembro.count())).toBe(1);
  });

  it('sinAlcance ve todas las iglesias', async () => {
    await dosIglesiasConMiembros();
    expect(await sinAlcance('seed', () => prisma.miembro.count())).toBe(2);
  });
});

/** Archivos .ts (sin pruebas) bajo `carpeta`, con su ruta relativa a backend/ en formato POSIX. */
function archivosTs(carpeta: string): string[] {
  return readdirSync(carpeta, { recursive: true, encoding: 'utf8' })
    .map((r) => path.join(carpeta, r).split(path.sep).join('/'))
    .filter((r) => r.endsWith('.ts') && !r.endsWith('.test.ts') && !r.includes('/generated/'));
}

describe('quién usa sinAlcance (E1-06, ADR-0007)', () => {
  // Lista cerrada. Agregar un archivo aquí es una decisión de revisión, no un arreglo rápido.
  const PERMITIDOS: Record<string, string> = {
    'prisma/seed.ts': 'seed',
  };

  it('solo la Coordinación, las semillas y los scripts, con su motivo', () => {
    const usos: Record<string, string> = {};
    for (const archivo of [...archivosTs('src'), ...archivosTs('prisma')]) {
      if (archivo === 'src/lib/contextoIglesia.ts') continue; // la define
      // Sin comentarios: la documentación puede nombrar sinAlcance sin usarlo
      const texto = readFileSync(archivo, 'utf8')
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n');
      for (const [, motivo] of texto.matchAll(/sinAlcance\(\s*'([a-z]+)'/g)) {
        usos[archivo] = motivo!;
      }
      if (/sinAlcance\(/.test(texto) && !usos[archivo]) usos[archivo] = '(sin motivo literal)';
    }
    expect(usos).toEqual(PERMITIDOS);
  });

  it('el motivo corresponde al lugar: coordinacion en src/, seed en prisma/, script en scripts/', () => {
    for (const [archivo, motivo] of Object.entries(PERMITIDOS)) {
      const esperado = archivo.startsWith('prisma/')
        ? 'seed'
        : archivo.startsWith('scripts/')
          ? 'script'
          : 'coordinacion';
      expect(motivo, archivo).toBe(esperado);
    }
  });
});
