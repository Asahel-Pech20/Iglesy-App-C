import { describe, expect, it } from 'vitest';
import { PERMISOS, PERMISOS_POR_ROL, ROLES, type RolUsuario, tienePermiso } from './permisos';

// Transcripción literal de la tabla de specs.md §3.
// Leyenda: C crear · L leer · E editar · D eliminar · minúscula = solo "propio" · — sin acceso.
const MATRIZ: Record<string, Record<RolUsuario, string>> = {
  usuarios: {
    COORDINACION: 'CLED',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: '—',
    SECRETARIO: '—',
    TESORERO: '—',
    COORDINADOR: '—',
  },
  configuracion: {
    COORDINACION: 'LE',
    ADMIN_IGLESIA: 'LE',
    PASTOR: 'L',
    SECRETARIO: 'L',
    TESORERO: 'L',
    COORDINADOR: 'L',
  },
  miembros: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: 'CLED',
    SECRETARIO: 'CLED',
    TESORERO: 'L',
    COORDINADOR: 'L',
  },
  ministerios: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: 'CLED',
    SECRETARIO: 'L',
    TESORERO: 'L',
    COORDINADOR: 'Le',
  },
  eventos: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: 'CLED',
    SECRETARIO: 'CLED',
    TESORERO: 'L',
    COORDINADOR: 'Lced',
  },
  asistencia: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLE',
    PASTOR: 'CLE',
    SECRETARIO: 'CLE',
    TESORERO: '—',
    COORDINADOR: 'cle',
  },
  anuncios: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: 'CLED',
    SECRETARIO: 'CLED',
    TESORERO: 'L',
    COORDINADOR: 'L',
  },
  donaciones: {
    COORDINACION: '—',
    ADMIN_IGLESIA: 'CLED',
    PASTOR: 'L',
    SECRETARIO: '—',
    TESORERO: 'CLED',
    COORDINADOR: '—',
  },
};

const ACCIONES: Record<string, string> = { C: 'crear', L: 'leer', E: 'editar', D: 'eliminar' };

// Fila "Reportes" y "Dashboard" de la tabla
const REPORTES_GENERALES: Record<RolUsuario, 'si' | 'propio' | 'no'> = {
  COORDINACION: 'no',
  ADMIN_IGLESIA: 'si',
  PASTOR: 'si',
  SECRETARIO: 'si',
  TESORERO: 'no',
  COORDINADOR: 'propio',
};
const REPORTES_INGRESOS: RolUsuario[] = ['ADMIN_IGLESIA', 'PASTOR', 'TESORERO'];
const DASHBOARD_CON_INGRESOS: RolUsuario[] = ['ADMIN_IGLESIA', 'PASTOR', 'TESORERO'];
// El dashboard es de una iglesia: la Coordinación nacional no lo tiene
const CON_DASHBOARD: readonly RolUsuario[] = ROLES.filter((rol) => rol !== 'COORDINACION');

describe('matriz de permisos (specs.md §3)', () => {
  for (const [modulo, fila] of Object.entries(MATRIZ)) {
    for (const rol of ROLES) {
      it(`${modulo} · ${rol} = ${fila[rol]}`, () => {
        const celda = fila[rol];
        for (const [letra, accion] of Object.entries(ACCIONES)) {
          const completo = celda.includes(letra);
          const propio = celda.includes(letra.toLowerCase());
          expect(tienePermiso(rol, `${modulo}:${accion}` as never)).toBe(completo);
          const permisoPropio = `${modulo}:${accion}-propio`;
          if ((PERMISOS as readonly string[]).includes(permisoPropio)) {
            expect(tienePermiso(rol, permisoPropio as never)).toBe(propio);
          } else {
            expect(propio).toBe(false);
          }
        }
      });
    }
  }

  it('reportes de miembros/asistencia/ministerios', () => {
    for (const rol of ROLES) {
      expect(tienePermiso(rol, 'reportes:generales')).toBe(REPORTES_GENERALES[rol] === 'si');
      expect(tienePermiso(rol, 'reportes:generales-propio')).toBe(
        REPORTES_GENERALES[rol] === 'propio',
      );
    }
  });

  it('reportes de ingresos', () => {
    for (const rol of ROLES) {
      expect(tienePermiso(rol, 'reportes:ingresos')).toBe(REPORTES_INGRESOS.includes(rol));
    }
  });

  it('dashboard: lo ve el personal de iglesia; ingresos solo con donaciones:leer', () => {
    for (const rol of ROLES) {
      expect(tienePermiso(rol, 'dashboard:leer')).toBe(CON_DASHBOARD.includes(rol));
      expect(tienePermiso(rol, 'donaciones:leer')).toBe(DASHBOARD_CON_INGRESOS.includes(rol));
    }
  });

  it('usuarios:opciones solo para COORDINACION, ADMIN_IGLESIA y PASTOR (specs.md §7.2, §12.3)', () => {
    expect(ROLES.filter((rol) => tienePermiso(rol, 'usuarios:opciones'))).toEqual([
      'COORDINACION',
      'ADMIN_IGLESIA',
      'PASTOR',
    ]);
  });

  it('cada permiso asignado existe y no hay duplicados', () => {
    for (const rol of ROLES) {
      const lista = PERMISOS_POR_ROL[rol];
      expect(new Set(lista).size).toBe(lista.length);
      for (const permiso of lista) expect(PERMISOS).toContain(permiso);
    }
  });

  it('todo permiso declarado lo tiene al menos un rol', () => {
    for (const permiso of PERMISOS) {
      expect(ROLES.some((rol) => tienePermiso(rol, permiso))).toBe(true);
    }
  });

  it('Ecclesia: el diezmo y los espacios son solo del personal de la iglesia, nunca de la Coordinación', () => {
    const quien = (permiso: (typeof PERMISOS)[number]) =>
      ROLES.filter((rol) => tienePermiso(rol, permiso));
    expect(quien('diezmo:capturar')).toEqual(['TESORERO']);
    expect(quien('diezmo:leer')).toEqual(['ADMIN_IGLESIA', 'TESORERO']);
    expect(quien('espacios:leer')).toEqual(['ADMIN_IGLESIA']);
    expect(quien('espacios:gestionar')).toEqual(['ADMIN_IGLESIA']);
    expect(quien('misas:leer')).toEqual(['ADMIN_IGLESIA', 'TESORERO']);
    expect(quien('misas:registrar')).toEqual(['ADMIN_IGLESIA']);
  });

  it('E2-05 y E2-06: la Coordinación carga el catálogo y cierra iglesias; el administrador edita la suya', () => {
    const quien = (permiso: (typeof PERMISOS)[number]) =>
      ROLES.filter((rol) => tienePermiso(rol, permiso));
    expect(quien('catalogos:gestionar')).toEqual(['COORDINACION']);
    expect(quien('iglesias:cerrar')).toEqual(['COORDINACION']);
    expect(quien('iglesias:editar')).toEqual(['COORDINACION', 'ADMIN_IGLESIA']);
  });
});
