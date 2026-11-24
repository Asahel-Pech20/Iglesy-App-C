import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import type {
  CerrarIglesia,
  CrearIglesia,
  EditarIglesia,
  Iglesia,
  LugarInegi,
  QueryIglesias,
} from '@/app/tipos/iglesias';

/**
 * Iglesias del sistema nacional. La Coordinación las lista, crea y cierra; el administrador edita
 * la suya (E2-06). También el catálogo del INEGI para elegir la ubicación (E2-05, RF-09).
 */
@Injectable({ providedIn: 'root' })
export class IglesiasService {
  private readonly api = inject(Api);

  /** Sube con cada cambio; las listas lo leen para recargarse. */
  readonly version = signal(0);
  private readonly cambio = tap(() => this.version.update((v) => v + 1));

  listar(query: QueryIglesias) {
    return this.api.lista<Iglesia>('/iglesias', { ...query });
  }

  obtener(id: string) {
    return this.api.objeto<Iglesia>(`/iglesias/${id}`);
  }

  crear(datos: CrearIglesia) {
    return this.api.post<Iglesia>('/iglesias', datos).pipe(this.cambio);
  }

  editar(id: string, datos: EditarIglesia) {
    return this.api.patch<Iglesia>(`/iglesias/${id}`, datos).pipe(this.cambio);
  }

  cerrar(id: string, datos: CerrarIglesia) {
    return this.api.post<Iglesia>(`/iglesias/${id}/cierre`, datos).pipe(this.cambio);
  }

  // Catálogo del INEGI (público). Hasta 100 por página; `q` acota los selectores largos.
  estados() {
    return this.api.lista<LugarInegi>('/public/estados', { limit: 100 });
  }

  municipios(estado: string, q?: string) {
    return this.api.lista<LugarInegi>(`/public/estados/${estado}/municipios`, { limit: 100, q });
  }

  localidades(municipio: string, q?: string) {
    return this.api.lista<LugarInegi>(`/public/municipios/${municipio}/localidades`, {
      limit: 100,
      q,
    });
  }
}
