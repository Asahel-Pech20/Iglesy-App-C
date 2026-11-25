// E3-05: reglas que la migración deja en la BD (CHECK y disparadores) para padres en varias
// iglesias, horario semanal de misas y sustituciones. Se prueban contra PostgreSQL real.
import { describe, expect, it } from 'vitest';
import { prisma } from '../../test/bd';
import { crearIglesia, crearUsuario } from '../../test/helpers';

async function base() {
  const iglesia = await crearIglesia({ nombre: 'Parroquia de San Miguel' });
  const capilla = await crearIglesia({ nombre: 'Capilla de la Merced', tipo: 'CAPILLA' });
  const admin = await crearUsuario('ADMIN_IGLESIA', { iglesiaId: iglesia.id });
  const titular = await prisma.padre.create({ data: { nombre: 'Andrés Ruiz', titulo: 'Pbro.' } });
  const vicario = await prisma.padre.create({ data: { nombre: 'Tomás Lara', titulo: 'Fr.' } });
  return { iglesia, capilla, admin, titular, vicario };
}

const horario = (iglesiaId: string, padreId: string, extra: Record<string, unknown> = {}) =>
  prisma.horarioMisa.create({
    data: { iglesiaId, padreId, diaSemana: 0, hora: '10:00', tipo: 'DOMINICAL', ...extra },
  });

describe('padres en varias iglesias (RF-41, RN-28)', () => {
  it('un padre se asocia a la parroquia y a su capilla', async () => {
    const { iglesia, capilla, titular } = await base();
    await prisma.padreIglesia.createMany({
      data: [
        { padreId: titular.id, iglesiaId: iglesia.id },
        { padreId: titular.id, iglesiaId: capilla.id },
      ],
    });
    const asociaciones = await prisma.padreIglesia.findMany({ where: { padreId: titular.id } });
    expect(asociaciones).toHaveLength(2);
    expect(asociaciones.every((a) => a.activo)).toBe(true);
  });

  it('no repite la misma asociación', async () => {
    const { iglesia, titular } = await base();
    await prisma.padreIglesia.create({ data: { padreId: titular.id, iglesiaId: iglesia.id } });
    await expect(
      prisma.padreIglesia.create({ data: { padreId: titular.id, iglesiaId: iglesia.id } }),
    ).rejects.toThrow();
  });
});

describe('horario semanal de misas (RF-42, RN-20, RN-21, RN-27)', () => {
  it('guarda día, hora local, tipo, idioma y padre; una hora por defecto', async () => {
    const { iglesia, titular } = await base();
    const misa = await horario(iglesia.id, titular.id, { idioma: 'NAHUATL' });
    expect(misa).toMatchObject({
      diaSemana: 0,
      hora: '10:00',
      tipo: 'DOMINICAL',
      idioma: 'NAHUATL',
    });
    expect(misa.duracionMin).toBeNull();
    expect(misa.activo).toBe(true);
  });

  it('el idioma es español si no se indica', async () => {
    const { iglesia, titular } = await base();
    expect((await horario(iglesia.id, titular.id)).idioma).toBe('ESPANOL');
  });

  it('rechaza un día fuera de 0 a 6', async () => {
    const { iglesia, titular } = await base();
    await expect(horario(iglesia.id, titular.id, { diaSemana: 7 })).rejects.toThrow(
      /horarios_misa_dia_valido/,
    );
    await expect(horario(iglesia.id, titular.id, { diaSemana: -1 })).rejects.toThrow(
      /horarios_misa_dia_valido/,
    );
  });

  it('rechaza horas mal escritas', async () => {
    const { iglesia, titular } = await base();
    for (const hora of ['24:00', '9:00', '10:60', '10h']) {
      await expect(horario(iglesia.id, titular.id, { hora })).rejects.toThrow(
        /horarios_misa_hora_valida/,
      );
    }
  });

  it('rechaza duraciones fuera de 1 a 720 minutos', async () => {
    const { iglesia, titular } = await base();
    await expect(horario(iglesia.id, titular.id, { duracionMin: 0 })).rejects.toThrow(
      /horarios_misa_duracion_valida/,
    );
    await expect(horario(iglesia.id, titular.id, { duracionMin: 721 })).rejects.toThrow(
      /horarios_misa_duracion_valida/,
    );
    expect((await horario(iglesia.id, titular.id, { duracionMin: 90 })).duracionMin).toBe(90);
  });

  it('no se borra un horario con misas celebradas: se da de baja', async () => {
    const { iglesia, titular } = await base();
    const h = await horario(iglesia.id, titular.id);
    await prisma.misaCelebrada.create({
      data: {
        iglesiaId: iglesia.id,
        padreId: titular.id,
        horarioMisaId: h.id,
        fecha: new Date('2026-11-22'),
        inicio: new Date('2026-11-22T16:00:00Z'),
      },
    });
    await expect(prisma.horarioMisa.delete({ where: { id: h.id } })).rejects.toThrow();
    const baja = await prisma.horarioMisa.update({ where: { id: h.id }, data: { activo: false } });
    expect(baja.activo).toBe(false);
  });
});

describe('misa celebrada (RF-48, RN-29)', () => {
  it('las misas del diezmo, sin horario, se siguen registrando igual', async () => {
    const { iglesia, titular } = await base();
    const misa = await prisma.misaCelebrada.create({
      data: { iglesiaId: iglesia.id, padreId: titular.id, inicio: new Date('2026-11-22T16:00Z') },
    });
    expect(misa).toMatchObject({ horarioMisaId: null, fecha: null, duracionMin: null });
  });

  it('una misa del horario necesita su fecha local', async () => {
    const { iglesia, titular } = await base();
    const h = await horario(iglesia.id, titular.id);
    await expect(
      prisma.misaCelebrada.create({
        data: {
          iglesiaId: iglesia.id,
          padreId: titular.id,
          horarioMisaId: h.id,
          inicio: new Date('2026-11-22T16:00Z'),
        },
      }),
    ).rejects.toThrow(/misas_celebradas_fecha_con_horario/);
  });

  it('una sola celebración por misa del horario y día (P-17)', async () => {
    const { iglesia, titular, admin } = await base();
    const h = await horario(iglesia.id, titular.id);
    const datos = {
      iglesiaId: iglesia.id,
      padreId: titular.id,
      horarioMisaId: h.id,
      fecha: new Date('2026-11-22'),
      inicio: new Date('2026-11-22T16:00Z'),
      registradoPorId: admin.id,
    };
    await prisma.misaCelebrada.create({ data: datos });
    await expect(prisma.misaCelebrada.create({ data: datos })).rejects.toThrow();
    // El domingo siguiente sí
    await prisma.misaCelebrada.create({
      data: { ...datos, fecha: new Date('2026-11-29'), inicio: new Date('2026-11-29T16:00Z') },
    });
    expect(await prisma.misaCelebrada.count({ where: { horarioMisaId: h.id } })).toBe(2);
  });

  it('no se registra en una iglesia distinta de la de su horario (RNF-10)', async () => {
    const { iglesia, capilla, titular } = await base();
    const h = await horario(iglesia.id, titular.id);
    await expect(
      prisma.misaCelebrada.create({
        data: {
          iglesiaId: capilla.id,
          padreId: titular.id,
          horarioMisaId: h.id,
          fecha: new Date('2026-11-22'),
          inicio: new Date('2026-11-22T16:00Z'),
        },
      }),
    ).rejects.toThrow(/misma iglesia que su misa del horario/);
  });
});

describe('sustitución de padre (RF-49, RF-50, RN-30)', () => {
  async function misaSustituida() {
    const datos = await base();
    const h = await horario(datos.iglesia.id, datos.titular.id);
    const misa = await prisma.misaCelebrada.create({
      data: {
        iglesiaId: datos.iglesia.id,
        padreId: datos.vicario.id,
        horarioMisaId: h.id,
        fecha: new Date('2026-11-22'),
        inicio: new Date('2026-11-22T16:00Z'),
        registradoPorId: datos.admin.id,
      },
    });
    return { ...datos, misa };
  }

  it('guarda quién cambió, el programado, el real, el motivo y la fecha', async () => {
    const { misa, titular, vicario, admin } = await misaSustituida();
    const s = await prisma.sustitucionMisa.create({
      data: {
        misaCelebradaId: misa.id,
        padreProgramadoId: titular.id,
        padreRealId: vicario.id,
        motivo: 'El párroco está enfermo.',
        hechaPorId: admin.id,
      },
    });
    expect(s).toMatchObject({
      padreProgramadoId: titular.id,
      padreRealId: vicario.id,
      hechaPorId: admin.id,
    });
    expect(s.hechaEn).toBeInstanceOf(Date);
  });

  it('no se edita ni se borra', async () => {
    const { misa, titular, vicario, admin } = await misaSustituida();
    const s = await prisma.sustitucionMisa.create({
      data: {
        misaCelebradaId: misa.id,
        padreProgramadoId: titular.id,
        padreRealId: vicario.id,
        motivo: 'Enfermedad.',
        hechaPorId: admin.id,
      },
    });
    await expect(
      prisma.sustitucionMisa.update({ where: { id: s.id }, data: { motivo: 'Otro motivo.' } }),
    ).rejects.toThrow(/no se pueden modificar ni borrar/);
    await expect(prisma.sustitucionMisa.delete({ where: { id: s.id } })).rejects.toThrow(
      /no se pueden modificar ni borrar/,
    );
    expect((await prisma.sustitucionMisa.findUniqueOrThrow({ where: { id: s.id } })).motivo).toBe(
      'Enfermedad.',
    );
  });

  it('el padre real debe ser el que ofició la misa', async () => {
    const { misa, titular, admin } = await misaSustituida();
    const otro = await prisma.padre.create({ data: { nombre: 'Julián Mena' } });
    await expect(
      prisma.sustitucionMisa.create({
        data: {
          misaCelebradaId: misa.id,
          padreProgramadoId: titular.id,
          padreRealId: otro.id,
          motivo: 'Viaje.',
          hechaPorId: admin.id,
        },
      }),
    ).rejects.toThrow(/padre real de la sustitución/);
  });

  it('el sustituto es otro padre y el motivo no está vacío', async () => {
    const { misa, vicario, admin } = await misaSustituida();
    await expect(
      prisma.sustitucionMisa.create({
        data: {
          misaCelebradaId: misa.id,
          padreProgramadoId: vicario.id,
          padreRealId: vicario.id,
          motivo: 'Sin cambio.',
          hechaPorId: admin.id,
        },
      }),
    ).rejects.toThrow(/sustituciones_misa_padres_distintos/);

    const titular = await prisma.padre.create({ data: { nombre: 'Rafael Soto' } });
    await expect(
      prisma.sustitucionMisa.create({
        data: {
          misaCelebradaId: misa.id,
          padreProgramadoId: titular.id,
          padreRealId: vicario.id,
          motivo: '   ',
          hechaPorId: admin.id,
        },
      }),
    ).rejects.toThrow(/sustituciones_misa_motivo_no_vacio/);
  });

  it('una sola sustitución por misa celebrada', async () => {
    const { misa, titular, vicario, admin } = await misaSustituida();
    const datos = {
      misaCelebradaId: misa.id,
      padreProgramadoId: titular.id,
      padreRealId: vicario.id,
      motivo: 'Enfermedad.',
      hechaPorId: admin.id,
    };
    await prisma.sustitucionMisa.create({ data: datos });
    await expect(prisma.sustitucionMisa.create({ data: datos })).rejects.toThrow();
  });
});
