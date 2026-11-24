import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import type { QueryLista } from '@/app/tipos/comunes';
import type {
  CambiarEstadoObjeto,
  CrearObjeto,
  CriteriosIndice,
  EditarObjeto,
  IndiceIglesia,
  ObjetoPatrimonial,
  QueryObjetos,
  VersionCriterios,
} from '@/app/tipos/patrimonio';

/** Objetos del patrimonio de una iglesia y criterios del índice (E2-08, E2-10). */
@Injectable({ providedIn: 'root' })
export class PatrimonioService {
  private readonly api = inject(Api);

  /** Sube con cada cambio de objetos o criterios; las vistas lo leen para recargarse. */
  readonly version = signal(0);
  private readonly cambio = tap(() => this.version.update((v) => v + 1));

  objetos(iglesiaId: string, query: QueryObjetos) {
    return this.api.lista<ObjetoPatrimonial>(`/iglesias/${iglesiaId}/objetos`, { ...query });
  }

  indice(iglesiaId: string) {
    return this.api.objeto<IndiceIglesia>(`/iglesias/${iglesiaId}/indice`);
  }

  crearObjeto(iglesiaId: string, datos: CrearObjeto) {
    return this.api
      .post<ObjetoPatrimonial>(`/iglesias/${iglesiaId}/objetos`, datos)
      .pipe(this.cambio);
  }

  editarObjeto(iglesiaId: string, objetoId: string, datos: EditarObjeto) {
    return this.api
      .patch<ObjetoPatrimonial>(`/iglesias/${iglesiaId}/objetos/${objetoId}`, datos)
      .pipe(this.cambio);
  }

  cambiarEstado(iglesiaId: string, objetoId: string, datos: CambiarEstadoObjeto) {
    return this.api
      .post<ObjetoPatrimonial>(`/iglesias/${iglesiaId}/objetos/${objetoId}/estado`, datos)
      .pipe(this.cambio);
  }

  criterios() {
    return this.api.objeto<VersionCriterios>('/criterios-indice');
  }

  guardarCriterios(datos: CriteriosIndice) {
    return this.api.put<VersionCriterios>('/criterios-indice', datos).pipe(this.cambio);
  }

  historialCriterios(query: QueryLista) {
    return this.api.lista<VersionCriterios>('/criterios-indice/historial', { ...query });
  }
}
