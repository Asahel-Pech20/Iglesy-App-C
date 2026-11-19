import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import type {
  AgrupacionDiezmo,
  AgrupadoDiezmo,
  Diezmo,
  MisaCelebrada,
  Padre,
  PeriodoDiezmo,
  QueryMisas,
  ResumenDiezmo,
} from '@/app/tipos/diezmo';

/** Monto válido del diezmo: hasta 10 enteros y 2 decimales, sin signo (mismo formato que el backend). */
export const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Diezmo y misas de la iglesia del usuario (E4). Las rutas cuelgan de /iglesias/:iglesiaId; el
 * backend vuelve a comprobar que la iglesia sea la del usuario (alcanceIglesia).
 */
@Injectable({ providedIn: 'root' })
export class DiezmoService {
  private readonly api = inject(Api);
  private readonly sesion = inject(SesionService);

  /** Sube con cada captura, corrección o misa nueva; las listas y reportes lo leen para recargarse. */
  readonly version = signal(0);
  private readonly cambio = () => this.version.update((v) => v + 1);

  /** Iglesia del usuario; la Coordinación no tiene (y tampoco ve el diezmo). */
  iglesiaId(): string {
    const id = this.sesion.usuario()?.iglesiaId;
    if (!id) throw new Error('Tu usuario no pertenece a una iglesia.');
    return id;
  }

  private ruta(resto: string) {
    return `/iglesias/${this.iglesiaId()}${resto}`;
  }

  // ───────── Padres y misas ─────────
  listarPadres() {
    return this.api.objeto<Padre[]>(this.ruta('/padres'));
  }

  crearPadre(nombre: string) {
    return this.api.post<Padre>(this.ruta('/padres'), { nombre });
  }

  listarMisas(query: QueryMisas) {
    return this.api.lista<MisaCelebrada>(this.ruta('/misas-celebradas'), { ...query });
  }

  registrarMisa(datos: { inicio: string; padreId: string }) {
    return this.api
      .post<MisaCelebrada>(this.ruta('/misas-celebradas'), datos)
      .pipe(tap(this.cambio));
  }

  // ───────── Captura y corrección ─────────
  obtener(misaId: string) {
    return this.api.objeto<Diezmo>(this.ruta(`/misas-celebradas/${misaId}/diezmo`));
  }

  capturar(misaId: string, monto: string) {
    return this.api
      .post<Diezmo>(this.ruta(`/misas-celebradas/${misaId}/diezmo`), { monto })
      .pipe(tap(this.cambio));
  }

  corregir(misaId: string, monto: string) {
    return this.api
      .patch<Diezmo>(this.ruta(`/misas-celebradas/${misaId}/diezmo`), { monto })
      .pipe(tap(this.cambio));
  }

  // ───────── Reportes ─────────
  resumen(periodo: PeriodoDiezmo) {
    return this.api.objeto<ResumenDiezmo>(this.ruta('/diezmo/resumen'), { ...periodo });
  }

  agrupado(periodo: PeriodoDiezmo, por: AgrupacionDiezmo) {
    return this.api.objeto<AgrupadoDiezmo>(this.ruta('/diezmo/agrupado'), { ...periodo, por });
  }
}
