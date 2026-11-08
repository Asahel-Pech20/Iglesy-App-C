import type { QueryLista } from './comunes';

// Espejo de backend/src/modules/iglesias (versión mínima).

export type TipoIglesia =
  'CATEDRAL' | 'BASILICA' | 'PARROQUIA' | 'TEMPLO' | 'CAPILLA' | 'SANTUARIO';

export interface Iglesia {
  id: string;
  nombre: string;
  tipo: TipoIglesia;
  zonaHoraria: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrearIglesia {
  nombre: string;
  tipo: TipoIglesia;
  zonaHoraria?: string;
}

export type QueryIglesias = QueryLista;
