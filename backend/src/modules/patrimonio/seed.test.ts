// E2-09: el seed de patrimonio cumple los mínimos del caso (specs.md §12.8) y es idempotente.
import { describe, expect, it } from 'vitest';
import { seedPatrimonio } from '../../../prisma/seed-patrimonio';
import { prisma } from '../../lib/prisma';
import * as consultasService from '../consultas/consultas.service';

describe('seed de patrimonio (E2-09)', () => {
  it('carga 32 estados, 40 iglesias en ≥ 3 estados y ≥ 8 municipios con todos los tipos y 120 objetos', async () => {
    const resultado = await seedPatrimonio();
    expect(resultado).toMatchObject({ estados: 32, iglesias: 40, objetos: 120 });
    expect(await prisma.estado.count()).toBe(32);

    const iglesias = await prisma.iglesia.findMany({
      select: { estadoClave: true, municipioClave: true, tipo: true },
    });
    expect(iglesias).toHaveLength(40);
    expect(new Set(iglesias.map((i) => i.estadoClave)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(iglesias.map((i) => i.municipioClave)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(iglesias.map((i) => i.tipo)).size).toBe(6);

    const anio = new Date().getFullYear();
    const objetos = await prisma.objetoPatrimonial.findMany({
      select: { anio: true, siglo: true },
    });
    const edades = objetos.map((o) => anio - (o.anio ?? ((o.siglo ?? 1) - 1) * 100 + 50));
    expect(objetos).toHaveLength(120);
    expect(edades.filter((e) => e >= 200).length).toBeGreaterThanOrEqual(15);
    expect(edades.filter((e) => e >= 300).length).toBeGreaterThanOrEqual(5);
  });

  it('la parroquia de CA-01 queda con 35.5 y entra al ranking; la cerrada y la vacía no', async () => {
    await seedPatrimonio();
    const ranking = await consultasService.reconocidas({ page: 1, limit: 100 });
    const parroquia = ranking.datos.find((i) =>
      i.nombre.startsWith('Parroquia de San Miguel Arcángel'),
    );
    expect(parroquia).toMatchObject({ indice: 35.5, distincion: 'Alto valor patrimonial' });
    expect(ranking.meta.total).toBeLessThanOrEqual(38);
    expect(ranking.datos.some((i) => i.nombre.includes('(ficticia)'))).toBe(true);
  });

  it('se puede correr dos veces sin duplicar nada', async () => {
    await seedPatrimonio();
    const segunda = await seedPatrimonio();
    expect(segunda.objetos).toBe(0);
    expect(await prisma.iglesia.count()).toBe(40);
    expect(await prisma.objetoPatrimonial.count()).toBe(120);
  });
});
