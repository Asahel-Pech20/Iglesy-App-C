import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Award, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import type { Lugar } from '@/app/tipos/patrimonio';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { TarjetaIglesia } from './tarjeta-iglesia';

/**
 * /reconocidas — iglesias más reconocidas del país, de un estado, municipio o ciudad, de mayor a
 * menor índice (E2-14: RF-19–RF-21, CA-06). Sin cerradas ni iglesias sin objetos.
 */
@Component({
  selector: 'app-reconocidas',
  imports: [
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
    SelectorLugar,
    TarjetaIglesia,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .filtros {
      display: grid;
      gap: 0 12px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    }
    .lista {
      display: grid;
      gap: 12px;
    }
    h1 {
      font-size: 24px;
      margin: 8px 0 4px;
    }
    .suave {
      color: var(--texto-suave);
      margin: 0 0 16px;
    }
  `,
  template: `
    <h1>Iglesias más reconocidas</h1>
    <p class="suave">Ordenadas por su índice de valor patrimonial, de mayor a menor.</p>
    <div class="filtros">
      <app-selector-lugar
        [estado]="f().estado || undefined"
        [municipio]="f().municipio || undefined"
        [localidad]="f().localidad || undefined"
        (cambio)="lugar($event)"
      />
    </div>
    @if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="4" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (ranking().length === 0) {
      <app-estado-vacio
        [icono]="iconos.Award"
        titulo="Aún no hay iglesias reconocidas aquí"
        descripcion="Solo aparecen iglesias abiertas con objetos patrimoniales registrados."
      />
    } @else {
      <ol class="lista" aria-label="Ranking de iglesias">
        @for (i of ranking(); track i.id) {
          <li style="list-style: none">
            <app-tarjeta-iglesia
              [id]="i.id"
              [nombre]="i.nombre"
              [tipo]="i.tipo"
              [estado]="i.estado"
              [municipio]="i.municipio"
              [localidad]="i.localidad"
              [indice]="i.indice"
              [distincion]="i.distincion"
              [posicion]="i.posicion"
            />
          </li>
        }
      </ol>
      <app-paginacion
        [meta]="consulta.value()!.meta"
        (cambio)="filtros.cambiar({ page: $event })"
      />
    }
  `,
})
export class ReconocidasPage {
  private readonly servicio = inject(ExplorarService);
  protected readonly iconos = { Award };
  protected readonly filtros = filtrosURL({ estado: '', municipio: '', localidad: '', page: 1 });
  protected readonly f = this.filtros.valores;

  /** El backend acepta un solo nivel de lugar: se manda el más específico. */
  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      this.servicio.reconocidas({
        ...(p.localidad
          ? { localidad: p.localidad }
          : p.municipio
            ? { municipio: p.municipio }
            : p.estado
              ? { estado: p.estado }
              : {}),
        page: p.page,
        limit: 20,
      }),
  });
  protected readonly ranking = computed(() => valorDe(this.consulta)?.data ?? []);

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }
}
