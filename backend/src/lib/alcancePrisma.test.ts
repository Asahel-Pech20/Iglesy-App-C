// E1-06 (ADR-0007): reescritura pura de los argumentos de Prisma para limitarlos a una iglesia
import { describe, expect, it } from 'vitest';
import { limitarAIglesia, MODELOS_CON_IGLESIA, tieneAlcance } from './alcancePrisma';

const IGLESIA = 'iglesia-a';

describe('limitarAIglesia (E1-06)', () => {
  it('las lecturas combinan el where con la iglesia (AND), sin perder el filtro original', () => {
    expect(limitarAIglesia('Miembro', 'findMany', { where: { activo: true } }, IGLESIA)).toEqual({
      where: { AND: [{ activo: true }, { iglesiaId: IGLESIA }] },
    });
    expect(limitarAIglesia('Evento', 'count', undefined, IGLESIA)).toEqual({
      where: { iglesiaId: IGLESIA },
    });
  });

  it('con llave única agrega la iglesia junto a la llave (otra iglesia = no existe)', () => {
    expect(
      limitarAIglesia('Donacion', 'update', { where: { id: 'd1' }, data: {} }, IGLESIA),
    ).toEqual({ where: { id: 'd1', iglesiaId: IGLESIA }, data: {} });
    expect(limitarAIglesia('Miembro', 'findUnique', { where: { id: 'm1' } }, IGLESIA)).toEqual({
      where: { id: 'm1', iglesiaId: IGLESIA },
    });
  });

  it('al crear pone la iglesia del contexto aunque los datos traigan otra', () => {
    expect(
      limitarAIglesia(
        'Anuncio',
        'create',
        { data: { titulo: 'x', iglesiaId: 'iglesia-b' } },
        IGLESIA,
      ),
    ).toEqual({ data: { titulo: 'x', iglesiaId: IGLESIA } });
    expect(
      limitarAIglesia(
        'Miembro',
        'createMany',
        { data: [{ nombre: 'a' }, { nombre: 'b' }] },
        IGLESIA,
      ),
    ).toEqual({
      data: [
        { nombre: 'a', iglesiaId: IGLESIA },
        { nombre: 'b', iglesiaId: IGLESIA },
      ],
    });
    expect(
      limitarAIglesia(
        'Ministerio',
        'upsert',
        { where: { id: 'x' }, create: {}, update: {} },
        IGLESIA,
      ),
    ).toEqual({
      where: { id: 'x', iglesiaId: IGLESIA },
      create: { iglesiaId: IGLESIA },
      update: {},
    });
  });

  it('las tablas puente se filtran por su extremo y no reciben iglesiaId al crear', () => {
    expect(
      limitarAIglesia('Asistencia', 'findMany', { where: { presente: true } }, IGLESIA),
    ).toEqual({
      where: { AND: [{ presente: true }, { evento: { iglesiaId: IGLESIA } }] },
    });
    expect(limitarAIglesia('MiembroMinisterio', 'deleteMany', {}, IGLESIA)).toEqual({
      where: { ministerio: { iglesiaId: IGLESIA } },
    });
    const datos = { data: [{ ministerioId: 'x', usuarioId: 'u' }] };
    expect(limitarAIglesia('MinisterioCoordinador', 'createMany', datos, IGLESIA)).toEqual(datos);
  });

  it('una operación desconocida falla en vez de quedar sin filtro', () => {
    expect(() => limitarAIglesia('Miembro', 'operacionNueva', {}, IGLESIA)).toThrow(/sin regla/);
  });

  it('no muta los argumentos recibidos', () => {
    const args = { where: { activo: true } };
    limitarAIglesia('Miembro', 'findMany', args, IGLESIA);
    expect(args).toEqual({ where: { activo: true } });
  });

  it('solo la gestión interna tiene alcance (usuarios, iglesias, diezmo… no)', () => {
    for (const modelo of MODELOS_CON_IGLESIA) expect(tieneAlcance(modelo)).toBe(true);
    expect(tieneAlcance('Asistencia')).toBe(true);
    for (const modelo of ['Usuario', 'Iglesia', 'Diezmo', 'SolicitudEspacio', undefined]) {
      expect(tieneAlcance(modelo)).toBe(false);
    }
  });
});
