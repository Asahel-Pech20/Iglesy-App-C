import type { Permiso, QueryLista, Rol } from './comunes';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  /** Iglesia del personal; null solo para la Coordinación (alcance nacional) */
  iglesiaId: string | null;
  activo: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /auth/me */
/** Iglesia del usuario en la sesión (E1-02); null solo en la Coordinación */
export interface IglesiaSesion {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface Sesion {
  usuario: Usuario;
  permisos: Permiso[];
  iglesia: IglesiaSesion | null;
}

/** POST /auth/login */
export interface RespuestaLogin extends Sesion {
  accessToken: string;
}

/** POST /auth/refresh */
export interface RespuestaRefresh {
  accessToken: string;
}

export interface QueryUsuarios extends QueryLista {
  rol?: Rol;
  activo?: boolean;
}

export interface CrearUsuario {
  nombre: string;
  email: string;
  rol: Rol;
  /** Solo la Coordinación la indica; el administrador crea en su propia iglesia */
  iglesiaId?: string;
}

export type EditarUsuario = Partial<CrearUsuario>;

/** GET /usuarios/opciones */
export interface OpcionUsuario {
  id: string;
  nombre: string;
  rol: Rol;
}
