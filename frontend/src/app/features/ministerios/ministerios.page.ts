import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Network, Plus, Users } from 'lucide-angular';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import { PuedeDirective } from '@/app/core/puede.directive';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { Paginacion } from '@/app/compartido/paginacion';
import type { Ministerio } from '@/app/tipos/ministerios';
import { MinisterioFormDialogo } from './dialogos';
import { MinisteriosService } from './ministerios.service';

/** /ministerios — tarjetas con búsqueda y filtro de estado (F2-07). */
@Component({
  selector: 'app-ministerios',
  imports: [
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    LucideAngularModule,
    PuedeDirective,
    PageHeader,
    CampoBusqueda,
    BadgeEstado,
    EstadoVacio,
    EstadoError,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Ministerios"
      descripcion="Grupos de servicio de la iglesia, sus coordinadores e integrantes."
    >
      <button *appPuede="'ministerios:crear'" matButton="filled" type="button" (click)="nuevo()">
        <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Nuevo ministerio
      </button>
    </app-page-header>

    <div class="filtros" role="search">
      <app-campo-busqueda
        [valor]="filtros.valores().q"
        placeholder="Buscar ministerio"
        (cambio)="filtros.cambiar({ q: $event })"
      />
      <mat-form-field subscriptSizing="dynamic" class="select-filtro">
        <mat-label>Estado</mat-label>
        <mat-select
          [value]="filtros.valores().estado"
          (valueChange)="filtros.cambiar({ estado: $event })"
        >
          @for (o of opcionesEstado; track o.valor) {
            <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (consulta.isLoading() && !consulta.hasValue()) {
      <div class="rejilla" role="status" aria-label="Cargando">
        @for (i of [1, 2, 3, 4, 5, 6]; track i) {
          <div class="tarjeta esqueleto"></div>
        }
      </div>
    } @else if (consulta.error()) {
      <section class="tarjeta">
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      </section>
    } @else if (filas().length === 0) {
      <section class="tarjeta">
        <app-estado-vacio
          [icono]="iconos.Network"
          [titulo]="
            filtros.valores().q ? 'No hay ministerios con estos filtros' : 'No hay ministerios'
          "
          descripcion="Prueba con otra búsqueda o registra un ministerio nuevo."
        >
          <button
            *appPuede="'ministerios:crear'"
            matButton="filled"
            type="button"
            (click)="nuevo()"
          >
            <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Nuevo ministerio
          </button>
        </app-estado-vacio>
      </section>
    } @else {
      <ul class="rejilla" aria-label="Ministerios">
        @for (m of filas(); track m.id) {
          <li class="tarjeta tarjeta-cuerpo ministerio">
            <div class="cabecera">
              <a [routerLink]="['/ministerios', m.id]" class="nombre">{{ m.nombre }}</a>
              <app-badge-estado [activo]="m.activo" />
            </div>
            <p class="texto-suave descripcion">{{ m.descripcion ?? 'Sin descripción.' }}</p>
            <p class="integrantes">
              <lucide-icon
                [img]="iconos.Users"
                [size]="16"
                class="texto-suave"
                aria-hidden="true"
              />
              {{ m.totalIntegrantes }} {{ m.totalIntegrantes === 1 ? 'integrante' : 'integrantes' }}
            </p>
            <p class="texto-suave pequeno">Coordinación: {{ coordinacion(m) }}</p>
          </li>
        }
      </ul>
      <section class="tarjeta paginas">
        <app-paginacion
          [meta]="consulta.value()!.meta"
          (cambio)="filtros.cambiar({ page: $event })"
        />
      </section>
    }
  `,
  styles: `
    .rejilla {
      display: grid;
      gap: 16px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 640px) {
      .rejilla {
        grid-template-columns: 1fr 1fr;
      }
    }
    @media (min-width: 1280px) {
      .rejilla {
        grid-template-columns: 1fr 1fr 1fr;
      }
    }
    .esqueleto {
      height: 144px;
      background: var(--superficie-suave);
    }
    .ministerio {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .nombre {
      font-size: 16px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    p {
      margin: 0;
    }
    .descripcion {
      flex: 1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .integrantes {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pequeno {
      font-size: 12px;
    }
    .paginas {
      margin-top: 16px;
    }
  `,
})
export class MinisteriosPage {
  private readonly servicio = inject(MinisteriosService);
  private readonly dialog = inject(MatDialog);

  protected readonly filtros = filtrosURL({ q: '', estado: 'activos', page: 1 });
  protected readonly consulta = rxResource({
    params: () => {
      const f = this.filtros.valores();
      return {
        q: f.q || undefined,
        activo: f.estado === 'todos' ? undefined : f.estado === 'activos',
        page: f.page,
        limit: 24,
      };
    },
    stream: ({ params }) => this.servicio.listar(params),
  });
  protected readonly filas = computed(() => valorDe(this.consulta)?.data ?? []);
  protected readonly opcionesEstado = [
    { valor: 'activos', etiqueta: 'Activos' },
    { valor: 'inactivos', etiqueta: 'Inactivos' },
    { valor: 'todos', etiqueta: 'Todos' },
  ];
  protected readonly iconos = { Plus, Network, Users };

  protected coordinacion(m: Ministerio) {
    return m.coordinadores.length > 0
      ? m.coordinadores.map((c) => c.nombre).join(', ')
      : 'sin asignar';
  }

  protected nuevo() {
    this.dialog
      .open(MinisterioFormDialogo, { width: '32rem', maxWidth: 'calc(100vw - 32px)' })
      .afterClosed()
      .subscribe((guardado) => guardado && this.consulta.reload());
  }
}
