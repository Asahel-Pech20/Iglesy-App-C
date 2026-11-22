import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { valorDe } from '@/app/core/recurso';
import type { Evento } from '@/app/tipos/eventos';
import { ListaEventos } from './componentes';
import { EventosService } from './eventos.service';
import { PermisosMinisterioService } from './permisos-ministerio.service';

/**
 * Pestaña "Actividades" del ministerio (F2-11): próximos eventos y los pasados.
 * @example <app-actividades-ministerio [ministerioId]="ministerio.id" />
 */
@Component({
  selector: 'app-actividades-ministerio',
  imports: [RouterLink, MatButton, LucideAngularModule, ListaEventos],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (puedeCrear()) {
      <div class="acciones">
        <a
          matButton="filled"
          routerLink="/eventos/nuevo"
          [queryParams]="{ ministerioId: ministerioId() }"
        >
          <lucide-icon [img]="iconoMas" [size]="16" aria-hidden="true" /> Nuevo evento
        </a>
      </div>
    }
    <div class="cuerpo">
      <h3>Próximas</h3>
      <app-lista-eventos
        [eventos]="proximas()"
        [cargando]="consulta.isLoading() && !consulta.hasValue()"
        [error]="consulta.error()"
        [conEstado]="true"
        vacio="No hay actividades programadas."
        etiqueta="Actividades próximas"
        (reintentar)="consulta.reload()"
      />
      <h3>Pasadas</h3>
      <app-lista-eventos
        [eventos]="pasadas()"
        [cargando]="consulta.isLoading() && !consulta.hasValue()"
        [conEstado]="true"
        vacio="Aún no hay actividades pasadas."
        etiqueta="Actividades pasadas"
      />
    </div>
  `,
  styles: `
    .acciones {
      display: flex;
      justify-content: flex-end;
      padding: 16px 16px 0;
    }
    .cuerpo {
      padding: 0 16px 16px;
    }
    h3 {
      margin: 16px 0 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--texto-suave);
    }
  `,
})
export class ActividadesMinisterio {
  readonly ministerioId = input.required<string>();
  /** Un ministerio inactivo no admite eventos nuevos (el backend respondería 422) */
  readonly activo = input(true);
  private readonly servicio = inject(EventosService);
  private readonly permisos = inject(PermisosMinisterioService);

  protected readonly puedeCrear = computed(
    () =>
      this.activo() &&
      this.permisos.puede('eventos:crear', 'eventos:crear-propio', this.ministerioId()),
  );
  protected readonly consulta = rxResource({
    params: () => ({
      ministerioId: this.ministerioId(),
      limit: 100,
      orden: 'fechaInicio:desc' as const,
    }),
    stream: ({ params }) => this.servicio.listar(params),
  });
  private readonly ahora = new Date().toISOString();
  private readonly todas = computed(() => valorDe(this.consulta)?.data ?? []);
  /** Programados y cancelados que aún no ocurren (el badge indica el estado) */
  private esProxima(e: Evento) {
    return e.estado === 'PROGRAMADO' || (e.estado === 'CANCELADO' && e.fechaInicio >= this.ahora);
  }
  protected readonly proximas = computed(() =>
    this.todas()
      .filter((e) => this.esProxima(e))
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)),
  );
  protected readonly pasadas = computed(() => this.todas().filter((e) => !this.esProxima(e)));
  protected readonly iconoMas = Plus;
}
