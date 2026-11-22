import type { RolUsuario } from '../config/permisos';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado; lo carga el middleware `autenticar`. */
      usuario?: {
        id: string;
        nombre: string;
        email: string;
        rol: RolUsuario;
        /** Iglesia del personal; null solo para la Coordinación (alcance nacional). */
        iglesiaId: string | null;
      };
      /** Iglesia del recurso, ya verificada por `alcanceIglesia` (ver `iglesiaAlcanceDe`). */
      iglesiaAlcance?: string;
    }
  }
}

export {};
