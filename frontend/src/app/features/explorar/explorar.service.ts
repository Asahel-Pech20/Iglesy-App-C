import { inject, Injectable } from '@angular/core';
import { Api } from '@/app/core/api';
import type { Cartelera } from '@/app/tipos/anuncios';
import type {
  FichaIglesia,
  IglesiaEnLista,
  IglesiaReconocida,
  QueryBusqueda,
  QueryListaPublica,
  QueryReconocidas,
  ResultadoBusqueda,
} from '@/app/tipos/patrimonio';

/** Consultas públicas (sin sesión): lista por estado, ficha, reconocidas y búsqueda (E2-14). */
@Injectable({ providedIn: 'root' })
export class ExplorarService {
  private readonly api = inject(Api);

  iglesias(query: QueryListaPublica) {
    return this.api.lista<IglesiaEnLista>('/public/iglesias', { ...query });
  }

  /** Cartelera de la iglesia (E1-06b): anuncios vigentes, próximos eventos y horarios. */
  cartelera(id: string) {
    return this.api.objeto<Cartelera>(`/public/iglesias/${id}/cartelera`);
  }

  ficha(id: string) {
    return this.api.objeto<FichaIglesia>(`/public/iglesias/${id}`);
  }

  reconocidas(query: QueryReconocidas) {
    return this.api.lista<IglesiaReconocida>('/public/reconocidas', { ...query });
  }

  busqueda(query: QueryBusqueda) {
    return this.api.lista<ResultadoBusqueda>('/public/busqueda-patrimonio', { ...query });
  }
}
