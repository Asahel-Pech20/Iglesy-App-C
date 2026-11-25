// E3-19 (Genaro, con Oscar): el seed del diezmo arma las misas celebradas a partir del horario,
// con el padre programado y algunas sustituciones válidas, y cada misa tiene su diezmo.
import { describe, expect, it } from 'vitest';
import { llenarDiezmo, prepararDiezmo } from '../../../prisma/seed-diezmo';
import { seedMisasYServicios } from '../../../prisma/seed-misas-servicios';
import { prisma } from '../../test/bd';
import { crearIglesia, crearUsuario } from '../../test/helpers';

describe('seed del diezmo desde el horario (E3-19)', () => {
  it('las misas salen del horario, con sustituciones válidas y su diezmo', async () => {
    const inicial = await crearIglesia({ nombre: 'Iglesia inicial de prueba' });
    await crearUsuario('TESORERO', { iglesiaId: inicial.id });
    for (let i = 0; i < 4; i++) await crearIglesia({ nombre: `Iglesia ${i}` });

    const preparado = await prepararDiezmo(inicial.id, 'hash-de-prueba');
    await seedMisasYServicios();
    const resumen = await llenarDiezmo(preparado);
    expect(resumen.iglesias).toBe(6);
    expect(resumen.misas).toBeGreaterThan(100);

    const misas = await prisma.misaCelebrada.findMany({
      include: { horarioMisa: true, sustitucion: true, diezmo: true },
    });
    expect(misas.length).toBe(resumen.misas);
    for (const m of misas) {
      // RF-48: cada misa sale de una misa del horario de su misma iglesia, en su día
      expect(m.horarioMisa).not.toBeNull();
      expect(m.horarioMisa!.iglesiaId).toBe(m.iglesiaId);
      expect(m.fecha).not.toBeNull();
      expect(new Date(`${m.fecha!.toISOString().slice(0, 10)}T12:00:00Z`).getUTCDay()).toBe(
        m.horarioMisa!.diaSemana,
      );
      expect(m.inicio.getTime()).toBeLessThanOrEqual(Date.now());
      expect(m.diezmo).not.toBeNull();
      // RN-29: sin sustitución la dio el programado; con sustitución, otro padre
      if (m.sustitucion) {
        expect(m.sustitucion.padreProgramadoId).toBe(m.horarioMisa!.padreId);
        expect(m.sustitucion.padreRealId).toBe(m.padreId);
        expect(m.padreId).not.toBe(m.horarioMisa!.padreId);
      } else {
        expect(m.padreId).toBe(m.horarioMisa!.padreId);
      }
    }

    const sustituciones = misas.filter((m) => m.sustitucion);
    expect(sustituciones.length).toBeGreaterThan(0);
    // Supuesto P-17: el sustituto queda asociado a la iglesia
    for (const m of sustituciones) {
      const asociado = await prisma.padreIglesia.findUnique({
        where: { padreId_iglesiaId: { padreId: m.padreId, iglesiaId: m.iglesiaId } },
      });
      expect(asociado?.activo).toBe(true);
    }

    // Idempotente: una segunda vuelta no crea misas
    expect((await llenarDiezmo(preparado)).misas).toBe(0);
  }, 60_000);

  it('sin horario, cada iglesia conserva las misas fijas del seed original', async () => {
    const inicial = await crearIglesia({ nombre: 'Iglesia sin horario' });
    await crearUsuario('TESORERO', { iglesiaId: inicial.id });
    const preparado = await prepararDiezmo(inicial.id, 'hash-de-prueba');
    const resumen = await llenarDiezmo(preparado);
    expect(resumen.misas).toBeGreaterThan(0);
    expect(await prisma.misaCelebrada.count({ where: { horarioMisaId: { not: null } } })).toBe(0);
    expect(await prisma.diezmo.count()).toBe(resumen.misas);
  }, 60_000);
});
