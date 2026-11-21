import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { Permiso } from '@/app/tipos/comunes';
import type { RespuestaLogin, RespuestaRefresh, Sesion } from '@/app/tipos/usuarios';
import { Api, guardarToken, registrarAlExpirarSesion } from './api';

export type EstadoSesion = 'cargando' | 'autenticado' | 'anonimo';

/**
 * Sesión del usuario. El access token vive solo en memoria (core/api.ts);
 * al cargar la página se recupera con la cookie httpOnly de refresh.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = signal<Sesion | null>(null);

  readonly estado = signal<EstadoSesion>('cargando');
  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  /** Iglesia del personal (E1-02); null en la Coordinación o sin sesión */
  readonly iglesia = computed(() => this.sesion()?.iglesia ?? null);
  readonly permisos = computed<readonly Permiso[]>(() => this.sesion()?.permisos ?? []);

  constructor() {
    // Si un refresh falla a mitad de uso, se cierra la sesión
    registrarAlExpirarSesion(() => {
      this.limpiar();
      void this.router.navigateByUrl('/login');
    });
  }

  /** ¿Tiene el permiso? Con varios basta con uno; sin permisos, siempre true. */
  puede(...permisos: Permiso[]): boolean {
    const propios = this.permisos();
    return permisos.length === 0 || permisos.some((p) => propios.includes(p));
  }

  /** Restaurar sesión al cargar (recargar la página no cierra sesión). */
  async restaurar() {
    try {
      const { accessToken } = await firstValueFrom(
        this.api.post<RespuestaRefresh>('/auth/refresh'),
      );
      guardarToken(accessToken);
      this.sesion.set(await firstValueFrom(this.api.objeto<Sesion>('/auth/me')));
      this.estado.set('autenticado');
    } catch {
      this.estado.set('anonimo');
    }
  }

  async iniciarSesion(email: string, password: string) {
    const { accessToken, ...datos } = await firstValueFrom(
      this.api.post<RespuestaLogin>('/auth/login', { email, password }),
    );
    guardarToken(accessToken);
    this.sesion.set(datos);
    this.estado.set('autenticado');
  }

  async cerrarSesion() {
    try {
      await firstValueFrom(this.api.post('/auth/logout'));
    } catch {
      // aunque falle, se limpia la sesión local
    } finally {
      this.limpiar();
      await this.router.navigateByUrl('/login');
    }
  }

  private limpiar() {
    guardarToken(null);
    this.sesion.set(null);
    this.estado.set('anonimo');
  }
}
