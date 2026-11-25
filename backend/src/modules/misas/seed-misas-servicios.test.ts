// E3-19: el seed de misas, servicios y pláticas cumple los mínimos de specs.md §12.8, sin choques de
// ningún padre (RN-26), y se puede volver a correr sin duplicar.
import { describe, expect, it } from 'vitest';
import { seedMisasYServicios } from '../../../prisma/seed-misas-servicios';
import { prisma } from '../../test/bd';
import { crearIglesia } from '../../test/helpers';
import { buscarChoque, semanasDeReferencia, type DiaSemana } from './dominio/solapes';

async function iglesias(n: number) {
  for (let i = 0; i < n; i++) {
    await crearIglesia({
      nombre: `Iglesia de prueba ${i}`,
      zonaHoraria: i % 4 === 0 ? 'America/Cancun' : 'America/Mexico_City',
    });
  }
}

describe('seed de misas, servicios y pláticas (E3-19)', () => {
  it('cumple los mínimos en cada iglesia y ningún padre choca', async () => {
    await iglesias(12);
    const resumen = await seedMisasYServicios();
    expect(resumen.iglesias).toBe(12);
    expect(resumen.padres).toBe(15);

    const lista = await prisma.iglesia.findMany({
      select: {
        horariosMisa: { select: { diaSemana: true } },
        servicios: { select: { nombre: true } },
        platicas: { select: { tipo: true } },
      },
    });
    for (const i of lista) {
      expect(new Set(i.horariosMisa.map((m) => m.diaSemana)).size).toBe(7);
      expect(i.servicios.map((s) => s.nombre)).toEqual(
        expect.arrayContaining(['Bautizo', 'Primera comunión', 'Confirmación', 'Matrimonio']),
      );
      expect(new Set(i.platicas.map((p) => p.tipo)).size).toBeGreaterThanOrEqual(2);
    }

    const padres = await prisma.padre.findMany({ select: { titulo: true, iglesias: true } });
    expect(padres).toHaveLength(15);
    expect(padres.every((p) => p.titulo)).toBe(true);
    expect(padres.filter((p) => p.iglesias.length > 1).length).toBeGreaterThanOrEqual(3);

    const horario = await prisma.horarioMisa.findMany({
      select: {
        id: true,
        iglesiaId: true,
        diaSemana: true,
        hora: true,
        duracionMin: true,
        padreId: true,
        iglesia: { select: { zonaHoraria: true } },
      },
    });
    const misas = horario.map((m) => ({
      ...m,
      diaSemana: m.diaSemana as DiaSemana,
      zonaHoraria: m.iglesia.zonaHoraria,
    }));
    const semanas = semanasDeReferencia(new Date());
    for (const m of misas) {
      const otras = misas.filter((o) => o.padreId === m.padreId && o.id !== m.id);
      expect(buscarChoque(m, otras, semanas)).toBeNull();
    }
    // Cada padre del horario está asociado a la iglesia donde celebra (RF-41)
    const asociaciones = await prisma.padreIglesia.findMany();
    for (const m of misas) {
      expect(asociaciones.some((a) => a.padreId === m.padreId && a.iglesiaId === m.iglesiaId)).toBe(
        true,
      );
    }
  }, 30_000);

  it('volver a correrlo no duplica nada', async () => {
    await iglesias(3);
    await seedMisasYServicios();
    const antes = await Promise.all([
      prisma.horarioMisa.count(),
      prisma.servicio.count(),
      prisma.platica.count(),
      prisma.padre.count(),
    ]);
    const segunda = await seedMisasYServicios();
    expect(segunda).toMatchObject({ misas: 0, servicios: 0, platicas: 0 });
    expect(
      await Promise.all([
        prisma.horarioMisa.count(),
        prisma.servicio.count(),
        prisma.platica.count(),
        prisma.padre.count(),
      ]),
    ).toEqual(antes);
  });

  it('completa lo que falta sin tocar lo que la iglesia ya capturó', async () => {
    await iglesias(1);
    const iglesia = await prisma.iglesia.findFirstOrThrow();
    await prisma.servicio.create({
      data: { iglesiaId: iglesia.id, nombre: 'BAUTIZO', formaCosto: 'GRATUITO' },
    });
    await seedMisasYServicios();
    const bautizos = await prisma.servicio.findMany({
      where: { iglesiaId: iglesia.id, nombre: { equals: 'bautizo', mode: 'insensitive' } },
    });
    expect(bautizos).toHaveLength(1);
    expect(bautizos[0]!.formaCosto).toBe('GRATUITO');
  });
});
