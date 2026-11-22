import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import type { CrearIglesia, Iglesia, QueryIglesias } from '@/app/tipos/iglesias';

/** Iglesias del sistema nacional; solo la Coordinación las lista y las crea. */
@Injectable({ providedIn: 'root' })
export class IglesiasService {
  private readonly api = inject(Api);

  /** Sube con cada alta; las listas lo leen para recargarse. */
  readonly version = signal(0);

  listar(query: QueryIglesias) {
    return this.api.lista<Iglesia>('/iglesias', { ...query });
  }

  crear(datos: CrearIglesia) {
    return this.api
      .post<Iglesia>('/iglesias', datos)
      .pipe(tap(() => this.version.update((v) => v + 1)));
  }
}
