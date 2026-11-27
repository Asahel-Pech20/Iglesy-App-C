import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { Api } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import type { MisaCelebrada, Padre, QueryMisas } from '@/app/tipos/diezmo';
import type {
  AgendaPadre,
  HorarioMisa,
  HorarioMisaEntrada,
  MisaDeHorarioEntrada,
  PadreNacional,
  ResultadoArmarSemana,
  SemanaMisas,
} from '@/app/tipos/misas';

/**
 * Misas de la iglesia del usuario (E3-15, Genaro): padres, horario semanal y misas celebradas. Las
 * rutas cuelgan de /iglesias/:iglesiaId; el backend vuelve a comprobar el alcance (RN-32).
 */
@Injectable({ providedIn: 'root' })
export class MisasService {
  private readonly api = inject(Api);
  private readonly sesion = inject(SesionService);

  /** Sube con cada cambio; las pestañas lo leen para recargarse. */
  readonly version = signal(0);
  private readonly cambio = () => this.version.update((v) => v + 1);

  iglesiaId(): string {
    const id = this.sesion.usuario()?.iglesiaId;
    if (!id) throw new Error('Tu usuario no pertenece a una iglesia.');
    return id;
  }

  private ruta(resto: string) {
    return `/iglesias/${this.iglesiaId()}${resto}`;
  }

  // ───────── Padres de la iglesia (E3-06) ─────────
  listarPadres() {
    return this.api.objeto<Padre[]>(this.ruta('/padres'));
  }

  crearPadre(datos: { nombre: string; titulo: string | null }) {
    return this.api.post<Padre>(this.ruta('/padres'), datos).pipe(tap(this.cambio));
  }

  asociarPadre(padreId: string) {
    return this.api.put<Padre>(this.ruta(`/padres/${padreId}`), {}).pipe(tap(this.cambio));
  }

  quitarPadre(padreId: string) {
    return this.api.delete(this.ruta(`/padres/${padreId}`)).pipe(tap(this.cambio));
  }

  // ───────── Padres de todo el país (Coordinación; búsqueda para asociar) ─────────
  buscarPadres(q: string, page = 1) {
    return this.api.lista<PadreNacional>('/padres', { q: q || undefined, page, limit: 20 });
  }

  crearPadreNacional(datos: { nombre: string; titulo: string | null }) {
    return this.api.post<PadreNacional>('/padres', datos).pipe(tap(this.cambio));
  }

  editarPadreNacional(
    id: string,
    datos: { nombre?: string; titulo?: string | null; activo?: boolean },
  ) {
    return this.api.patch<PadreNacional>(`/padres/${id}`, datos).pipe(tap(this.cambio));
  }

  agenda(padreId: string, semana?: string) {
    return this.api.objeto<AgendaPadre>(`/padres/${padreId}/agenda`, { semana });
  }

  // ───────── Horario semanal (E3-07) ─────────
  listarHorario() {
    return this.api.objeto<HorarioMisa[]>(this.ruta('/horario-misas'));
  }

  programar(datos: HorarioMisaEntrada) {
    return this.api.post<HorarioMisa>(this.ruta('/horario-misas'), datos).pipe(tap(this.cambio));
  }

  cambiarMisa(id: string, datos: Partial<HorarioMisaEntrada>) {
    return this.api
      .patch<HorarioMisa>(this.ruta(`/horario-misas/${id}`), datos)
      .pipe(tap(this.cambio));
  }

  quitarMisa(id: string) {
    return this.api.delete(this.ruta(`/horario-misas/${id}`)).pipe(tap(this.cambio));
  }

  // ───────── Misas celebradas (E3-09) ─────────
  listarCelebradas(query: QueryMisas) {
    return this.api.lista<MisaCelebrada>(this.ruta('/misas-celebradas'), { ...query });
  }

  // ───────── Semana armada desde el horario (RF-84) ─────────
  semana(semana?: string) {
    return this.api.objeto<SemanaMisas>(this.ruta('/semana-misas'), { semana });
  }

  armarSemana(semana: string) {
    return this.api
      .post<ResultadoArmarSemana>(this.ruta('/misas-celebradas/semana'), { semana })
      .pipe(tap(this.cambio));
  }

  registrarDesdeHorario(datos: MisaDeHorarioEntrada) {
    return this.api
      .post<MisaCelebrada>(this.ruta('/misas-celebradas'), datos)
      .pipe(tap(this.cambio));
  }
}
