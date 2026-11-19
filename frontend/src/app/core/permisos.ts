// Copia exacta de backend/src/config/permisos.ts (specs.md §3). Si cambia allá, se cambia aquí en el mismo PR.

// COORDINACION es nacional (sin iglesia); los demás roles pertenecen a una iglesia (Usuario.iglesiaId).
export const ROLES = [
  'COORDINACION',
  'ADMIN_IGLESIA',
  'PASTOR',
  'SECRETARIO',
  'TESORERO',
  'COORDINADOR',
] as const;
export type RolUsuario = (typeof ROLES)[number];

export const PERMISOS = [
  'usuarios:crear',
  'usuarios:leer',
  'usuarios:editar',
  'usuarios:eliminar',
  'usuarios:opciones',
  'configuracion:leer',
  'configuracion:editar',
  'miembros:crear',
  'miembros:leer',
  'miembros:editar',
  'miembros:eliminar',
  'ministerios:crear',
  'ministerios:leer',
  'ministerios:editar',
  'ministerios:eliminar',
  'ministerios:editar-propio',
  'eventos:crear',
  'eventos:leer',
  'eventos:editar',
  'eventos:eliminar',
  'eventos:crear-propio',
  'eventos:editar-propio',
  'eventos:eliminar-propio',
  'asistencia:crear',
  'asistencia:leer',
  'asistencia:editar',
  'asistencia:crear-propio',
  'asistencia:leer-propio',
  'asistencia:editar-propio',
  'anuncios:crear',
  'anuncios:leer',
  'anuncios:editar',
  'anuncios:eliminar',
  'donaciones:crear',
  'donaciones:leer',
  'donaciones:editar',
  'donaciones:eliminar',
  'dashboard:leer',
  'reportes:generales',
  'reportes:generales-propio',
  'reportes:ingresos',
  // Ecclesia: diezmo de las misas y solicitudes de espacio (criptas, nichos, columbarios, osarios)
  'diezmo:capturar',
  'diezmo:leer',
  'espacios:leer',
  'espacios:gestionar',
  // Misas celebradas y padres (versión mínima que necesita el diezmo)
  'misas:leer',
  'misas:registrar',
  // Iglesias del sistema nacional (solo la Coordinación)
  'iglesias:leer',
  'iglesias:crear',
  // E2-05 y E2-06 (Nataly): catálogo del INEGI, edición y cierre de iglesias
  'iglesias:editar',
  'iglesias:cerrar',
  'catalogos:gestionar',
] as const;

export type Permiso = (typeof PERMISOS)[number];

const CLED = (modulo: string) =>
  ['crear', 'leer', 'editar', 'eliminar'].map((accion) => `${modulo}:${accion}`) as Permiso[];

export const PERMISOS_POR_ROL: Record<RolUsuario, readonly Permiso[]> = {
  // Personal de la Coordinación Nacional: usuarios y configuración. No ve el diezmo ni los datos de
  // los solicitantes de espacio, que son solo del personal de cada iglesia (RNF-08, RNF-09).
  COORDINACION: [
    ...CLED('usuarios'),
    'usuarios:opciones',
    'configuracion:leer',
    // Marcador (supuesto S-04, plan-santiago.md): hasta que exista la edición de iglesias de Nataly
    'configuracion:editar',
    'iglesias:leer',
    'iglesias:crear',
    'iglesias:editar',
    'iglesias:cerrar',
    'catalogos:gestionar',
  ],
  ADMIN_IGLESIA: [
    ...CLED('usuarios'),
    'usuarios:opciones',
    'configuracion:leer',
    'configuracion:editar',
    // Datos de SU iglesia (RF-08); alcanceIglesia impide tocar otra
    'iglesias:editar',
    ...CLED('miembros'),
    ...CLED('ministerios'),
    ...CLED('eventos'),
    'asistencia:crear',
    'asistencia:leer',
    'asistencia:editar',
    ...CLED('anuncios'),
    ...CLED('donaciones'),
    'dashboard:leer',
    'reportes:generales',
    'reportes:ingresos',
    'diezmo:leer',
    'espacios:leer',
    'espacios:gestionar',
    'misas:leer',
    'misas:registrar',
  ],
  PASTOR: [
    'usuarios:opciones',
    'configuracion:leer',
    ...CLED('miembros'),
    ...CLED('ministerios'),
    ...CLED('eventos'),
    'asistencia:crear',
    'asistencia:leer',
    'asistencia:editar',
    ...CLED('anuncios'),
    'donaciones:leer',
    'dashboard:leer',
    'reportes:generales',
    'reportes:ingresos',
  ],
  SECRETARIO: [
    'configuracion:leer',
    ...CLED('miembros'),
    'ministerios:leer',
    ...CLED('eventos'),
    'asistencia:crear',
    'asistencia:leer',
    'asistencia:editar',
    ...CLED('anuncios'),
    'dashboard:leer',
    'reportes:generales',
  ],
  TESORERO: [
    'configuracion:leer',
    'miembros:leer',
    'ministerios:leer',
    'eventos:leer',
    'anuncios:leer',
    ...CLED('donaciones'),
    'dashboard:leer',
    'reportes:ingresos',
    'diezmo:capturar',
    'diezmo:leer',
    'misas:leer',
  ],
  COORDINADOR: [
    'configuracion:leer',
    'miembros:leer',
    'ministerios:leer',
    'ministerios:editar-propio',
    'eventos:leer',
    'eventos:crear-propio',
    'eventos:editar-propio',
    'eventos:eliminar-propio',
    'asistencia:crear-propio',
    'asistencia:leer-propio',
    'asistencia:editar-propio',
    'anuncios:leer',
    'dashboard:leer',
    'reportes:generales-propio',
  ],
};

export function tienePermiso(rol: RolUsuario, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}
