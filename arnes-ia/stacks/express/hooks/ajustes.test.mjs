import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, combinarAjustes } from './ajustes.mjs';

describe('ajustes del pre-commit', () => {
  it('sin arnes.config.json usa los valores por defecto', () => {
    expect(combinarAjustes(null)).toEqual(AJUSTES_POR_DEFECTO);
  });

  it('un proyecto con backend/ cambia solo lo que declara', () => {
    const ajustes = combinarAjustes(
      JSON.stringify({
        dependencias: { rutas: ['backend/src'], conocidas: 'backend/conocidas.json' },
        pruebas: { cwd: 'backend' },
      }),
    );
    expect(ajustes.dependencias).toEqual({
      rutas: ['backend/src'],
      config: AJUSTES_POR_DEFECTO.dependencias.config,
      conocidas: 'backend/conocidas.json',
      accesoDatos: null,
    });
    expect(ajustes.pruebas).toEqual({ cwd: 'backend', args: ['run'] });
  });

  it('rechaza un JSON roto o rutas vacías con un mensaje claro', () => {
    expect(() => combinarAjustes('{')).toThrow('no es JSON válido');
    expect(() => combinarAjustes('[]')).toThrow('debe ser un objeto');
    expect(() => combinarAjustes('{"dependencias":{"rutas":[]}}')).toThrow('dependencias.rutas');
    expect(() => combinarAjustes('{"pruebas":{"args":"run"}}')).toThrow('pruebas.args');
    expect(() => combinarAjustes('{"dependencias":{"accesoDatos":[]}}')).toThrow('accesoDatos');
  });
});
