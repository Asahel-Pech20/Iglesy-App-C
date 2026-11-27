import { HttpClient, HttpEventType } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { filter, map, type Observable, tap } from 'rxjs';
import { Api } from '@/app/core/api';
import { API_URL } from '@/app/core/config';
import { SesionService } from '@/app/core/sesion.service';
import type { RespuestaObjeto } from '@/app/tipos/comunes';
import type {
  ConfiguracionIglesia,
  EditarConfiguracion,
  GuardarHorario,
  HorarioReunion,
} from '@/app/tipos/configuracion';
import { MAX_LOGO_BYTES, TIPOS_LOGO } from './catalogos';

/** Avance de la subida del logo: porcentaje mientras sube y la configuración al terminar. */
export type AvanceLogo = { porcentaje: number } | { config: ConfiguracionIglesia };

/** Valida el archivo del logo antes de subirlo; devuelve el mensaje de error o null. */
export function validarLogo(archivo: File): string | null {
  if (!(TIPOS_LOGO as readonly string[]).includes(archivo.type)) {
    return 'Formato no permitido. Usa PNG, JPG, WEBP o SVG.';
  }
  if (archivo.size > MAX_LOGO_BYTES) return 'El archivo supera 2 MB.';
  return null;
}

/** De quién es la configuración que toca mostrar (E1-06b). */
type Llave = 'publica' | 'nacional' | `iglesia:${string}`;

/**
 * Configuración de la iglesia (nombre, logo, moneda, zona…). E1-06b: es la de la iglesia del
 * usuario, así que se vuelve a pedir al cambiar la sesión. Sin sesión es la de la iglesia inicial
 * (pantalla de login). La Coordinación no tiene iglesia propia: no se pide (el backend exigiría
 * ?iglesiaId) y la marca muestra «Coordinación Nacional».
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionService);
  /** ¿Algún componente la pidió? Hasta entonces no se carga nada. */
  private querida = false;
  private cargadaPara: Llave | null = null;

  /** null mientras carga, en la Coordinación o si falló (el layout usa el nombre por defecto) */
  readonly actual = signal<ConfiguracionIglesia | null>(null);

  private readonly llave = computed<Llave | null>(() => {
    const estado = this.sesion.estado();
    if (estado === 'cargando') return null;
    if (estado === 'anonimo') return 'publica';
    const iglesia = this.sesion.iglesia();
    return iglesia ? `iglesia:${iglesia.id}` : 'nacional';
  });

  constructor() {
    // Al iniciar o cerrar sesión (o cambiar de usuario) se pide la de la nueva iglesia
    effect(() => {
      const llave = this.llave();
      untracked(() => {
        if (this.querida && llave !== this.cargadaPara) this.pedir(llave);
      });
    });
  }

  /** Carga la configuración de la sesión actual (una vez por sesión, o de nuevo con `forzar`). */
  cargar(forzar = false) {
    this.querida = true;
    const llave = untracked(this.llave);
    if (forzar || llave !== this.cargadaPara) this.pedir(llave);
  }

  private pedir(llave: Llave | null) {
    if (llave === null) return; // la sesión aún se está restaurando
    this.cargadaPara = llave;
    if (llave === 'nacional') {
      this.actual.set(null);
      return;
    }
    this.api.objeto<ConfiguracionIglesia>('/configuracion').subscribe({
      next: (config) => {
        // Si la sesión cambió mientras llegaba, se descarta
        if (this.cargadaPara === llave) this.actual.set(config);
      },
      error: () => {
        if (this.cargadaPara === llave) this.cargadaPara = null;
      },
    });
  }

  /** La de la iglesia de la sesión; la Coordinación indica cuál (el backend exige ?iglesiaId). */
  obtener(iglesiaId?: string) {
    return this.api.objeto<ConfiguracionIglesia>('/configuracion', { iglesiaId });
  }

  actualizar(datos: EditarConfiguracion) {
    return this.api
      .put<ConfiguracionIglesia>('/configuracion', datos)
      .pipe(tap((config) => this.actual.set(config)));
  }

  subirLogo(archivo: File): Observable<AvanceLogo> {
    const form = new FormData();
    form.append('logo', archivo);
    return this.http
      .post<RespuestaObjeto<ConfiguracionIglesia>>(`${API_URL}/configuracion/logo`, form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
        map((e): AvanceLogo => {
          if (e.type === HttpEventType.Response) return { config: e.body!.data };
          const total = e.type === HttpEventType.UploadProgress ? e.total : undefined;
          const cargado = e.type === HttpEventType.UploadProgress ? e.loaded : 0;
          return { porcentaje: total ? Math.round((cargado / total) * 100) : 0 };
        }),
        tap((avance) => {
          if ('config' in avance) this.actual.set(avance.config);
        }),
      );
  }

  listarHorarios(iglesiaId?: string) {
    return this.api.objeto<HorarioReunion[]>('/configuracion/horarios', { iglesiaId });
  }

  guardarHorario(datos: GuardarHorario, id?: string) {
    return id
      ? this.api.patch<HorarioReunion>(`/configuracion/horarios/${id}`, datos)
      : this.api.post<HorarioReunion>('/configuracion/horarios', datos);
  }

  eliminarHorario(id: string) {
    return this.api.delete(`/configuracion/horarios/${id}`);
  }
}
