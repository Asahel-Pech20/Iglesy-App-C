import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import type {
  Platica,
  PlaticaEntrada,
  PlaticaPublica,
  Servicio,
  ServicioEntrada,
  TipoPlatica,
} from '@/app/tipos/servicios';

/** Dinero como en el backend: hasta 10 enteros y 2 decimales, sin signo. */
export const FORMATO_DINERO = /^\d{1,10}(\.\d{1,2})?$/;

/** Servicios y pláticas de la iglesia del usuario (E3-17, Genaro). */
@Injectable({ providedIn: 'root' })
export class ServiciosService {
  private readonly api = inject(Api);
  private readonly sesion = inject(SesionService);

  readonly version = signal(0);
  private readonly cambio = () => this.version.update((v) => v + 1);

  private ruta(resto: string) {
    const id = this.sesion.usuario()?.iglesiaId;
    if (!id) throw new Error('Tu usuario no pertenece a una iglesia.');
    return `/iglesias/${id}${resto}`;
  }

  listarServicios() {
    return this.api.objeto<Servicio[]>(this.ruta('/servicios'));
  }

  crearServicio(datos: ServicioEntrada) {
    return this.api.post<Servicio>(this.ruta('/servicios'), datos).pipe(tap(this.cambio));
  }

  editarServicio(id: string, datos: Partial<ServicioEntrada>) {
    return this.api.patch<Servicio>(this.ruta(`/servicios/${id}`), datos).pipe(tap(this.cambio));
  }

  quitarServicio(id: string) {
    return this.api.delete(this.ruta(`/servicios/${id}`)).pipe(tap(this.cambio));
  }

  listarPlaticas() {
    return this.api.objeto<Platica[]>(this.ruta('/platicas'));
  }

  crearPlatica(datos: PlaticaEntrada) {
    return this.api.post<Platica>(this.ruta('/platicas'), datos).pipe(tap(this.cambio));
  }

  editarPlatica(id: string, datos: Partial<PlaticaEntrada>) {
    return this.api.patch<Platica>(this.ruta(`/platicas/${id}`), datos).pipe(tap(this.cambio));
  }

  quitarPlatica(id: string) {
    return this.api.delete(this.ruta(`/platicas/${id}`)).pipe(tap(this.cambio));
  }

  /** Sin sesión: «¿cuándo son las pláticas de bautizo?» (RF-39) */
  platicasPublicas(iglesiaId: string, tipo?: TipoPlatica) {
    return this.api.objeto<PlaticaPublica[]>(`/public/iglesias/${iglesiaId}/platicas`, { tipo });
  }
}
