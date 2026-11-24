import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CalendarCheck } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { formatearFechaHora } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { AsistenciaService } from './asistencia.service';

/**
 * Pestaña "Asistencia" del perfil de un miembro (F2-04): historial de eventos.
 * @example <app-asistencia-del-miembro [miembroId]="miembro.id" />
 */
@Component({
  selector: 'app-asistencia-del-miembro',
  imports: [RouterLink, BadgeEstado, EstadoError, EstadoVacio, Esqueleto, Paginacion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="4" [columnas]="3" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (filas().length === 0) {
      <app-estado-vacio
        [icono]="iconoVacio"
        titulo="Este miembro aún no tiene asistencia registrada"
      />
    } @else {
      <ul aria-label="Historial de asistencia del miembro" class="lista">
        @for (a of filas(); track a.id) {
          <li>
            <div class="datos">
              <a [routerLink]="['/eventos', a.evento.id]" class="titulo">{{ a.evento.titulo }}</a>
              <p class="texto-suave">{{ fechaHora(a.evento.fechaInicio) }}</p>
            </div>
            <app-badge-estado
              [etiqueta]="a.presente ? 'Presente' : 'Ausente'"
              [variante]="a.presente ? 'exito' : 'peligro'"
            />
          </li>
        }
      </ul>
      <app-paginacion [meta]="consulta.value()!.meta" (cambio)="pagina.set($event)" />
    }
  `,
  styles: `
    .lista {
      margin: 0;
      padding: 0 16px;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
    }
    li + li {
      border-top: 1px solid var(--marco);
    }
    .datos p {
      margin: 0;
      font-size: 14px;
    }
    .titulo {
      font-weight: 500;
    }
  `,
})
export class AsistenciaDelMiembro {
  readonly miembroId = input.required<string>();
  private readonly servicio = inject(AsistenciaService);
  protected readonly pagina = signal(1);

  protected readonly consulta = rxResource({
    params: () => ({ miembroId: this.miembroId(), page: this.pagina() }),
    stream: ({ params }) => this.servicio.listar(params),
  });
  protected readonly filas = computed(() => valorDe(this.consulta)?.data ?? []);
  protected readonly iconoVacio = CalendarCheck;
  protected readonly fechaHora = formatearFechaHora;
}
