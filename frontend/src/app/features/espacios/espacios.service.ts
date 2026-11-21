import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import type {
  ClaseEspacio,
  CotizarSolicitud,
  CrearSolicitudPublica,
  QuerySolicitudes,
  RespuestaSolicitud,
  SeguimientoSolicitud,
  SolicitudCreada,
  SolicitudEspacio,
  TipoEspacio,
  TiposPublicos,
} from '@/app/tipos/espacios';

/**
 * Criptas, nichos, columbarios y osarios (E4-08 a E4-11). El panel cuelga de /iglesias/:iglesiaId y
 * el backend vuelve a comprobar que sea la iglesia del usuario; lo público va sin sesión, con folio
 * y clave. La clave viaja en el cuerpo, nunca en la URL.
 */
@Injectable({ providedIn: 'root' })
export class EspaciosService {
  private readonly api = inject(Api);
  private readonly sesion = inject(SesionService);

  /** Sube con cada cambio del panel; las listas lo leen para recargarse. */
  readonly version = signal(0);
  private readonly cambio = () => this.version.update((v) => v + 1);

  private ruta(resto: string) {
    const id = this.sesion.usuario()?.iglesiaId;
    if (!id) throw new Error('Tu usuario no pertenece a una iglesia.');
    return `/iglesias/${id}${resto}`;
  }

  // ───────── Panel ─────────
  listarTipos() {
    return this.api.objeto<TipoEspacio[]>(this.ruta('/tipos-espacio'));
  }

  crearTipo(clase: ClaseEspacio) {
    return this.api
      .post<TipoEspacio>(this.ruta('/tipos-espacio'), { clase })
      .pipe(tap(this.cambio));
  }

  editarTipo(id: string, cambios: { activo?: boolean; disponible?: boolean }) {
    return this.api
      .patch<TipoEspacio>(this.ruta(`/tipos-espacio/${id}`), cambios)
      .pipe(tap(this.cambio));
  }

  listarSolicitudes(query: QuerySolicitudes) {
    return this.api.lista<SolicitudEspacio>(this.ruta('/solicitudes-espacio'), { ...query });
  }

  obtenerSolicitud(id: string) {
    return this.api.objeto<SolicitudEspacio>(this.ruta(`/solicitudes-espacio/${id}`));
  }

  cotizar(id: string, datos: CotizarSolicitud) {
    return this.api
      .post<SolicitudEspacio>(this.ruta(`/solicitudes-espacio/${id}/cotizacion`), datos)
      .pipe(tap(this.cambio));
  }

  marcarSinLugar(id: string) {
    return this.api
      .post<SolicitudEspacio>(this.ruta(`/solicitudes-espacio/${id}/sin-lugar`))
      .pipe(tap(this.cambio));
  }

  // ───────── Público (sin sesión) ─────────
  tiposPublicos(iglesiaId: string) {
    return this.api.objeto<TiposPublicos>(`/public/iglesias/${iglesiaId}/espacios`);
  }

  crearSolicitud(iglesiaId: string, datos: CrearSolicitudPublica) {
    return this.api.post<SolicitudCreada>(
      `/public/iglesias/${iglesiaId}/solicitudes-espacio`,
      datos,
    );
  }

  consultar(folio: string, clave: string) {
    return this.api.post<SeguimientoSolicitud>(
      `/public/solicitudes-espacio/${encodeURIComponent(folio)}/consulta`,
      { clave },
    );
  }

  responder(folio: string, clave: string, accion: RespuestaSolicitud) {
    return this.api.post<SeguimientoSolicitud>(
      `/public/solicitudes-espacio/${encodeURIComponent(folio)}/${accion}`,
      { clave },
    );
  }
}
