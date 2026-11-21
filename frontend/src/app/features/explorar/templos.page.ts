import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { Church, LucideAngularModule } from 'lucide-angular';
import { of } from 'rxjs';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_IGLESIA, opcionesDe } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import type { TipoIglesia } from '@/app/tipos/iglesias';
import type { Lugar } from '@/app/tipos/patrimonio';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { TarjetaIglesia } from './tarjeta-iglesia';

/**
 * /templos — el visitante elige un estado y ve sus iglesias activas; acota por municipio,
 * localidad, tipo, nombre y capacidad (E2-14: RF-01–RF-05, RF-18, CA-02, CA-03).
 */
@Component({
  selector: 'app-templos',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    LucideAngularModule,
    CampoBusqueda,
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
    <h1>Iglesias de México</h1>
    <p class="suave">Elige un estado para ver sus iglesias y su valor patrimonial.</p>

    <div class="filtros">
      <app-selector-lugar
        textoSinEstado="Elige un estado"
        [estado]="f().estado || undefined"
        [municipio]="f().municipio || undefined"
        [localidad]="f().localidad || undefined"
        (cambio)="lugar($event)"
      />
      @if (f().estado) {
        <mat-form-field>
          <mat-label>Tipo</mat-label>
          <mat-select
            [value]="f().tipo"
            (selectionChange)="filtros.cambiar({ tipo: $event.value })"
          >
            <mat-option value="">Todos</mat-option>
            @for (t of tipos; track t.valor) {
              <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-campo-busqueda
          etiqueta="Nombre"
          placeholder="Parte del nombre…"
          [valor]="f().q"
          (cambio)="filtros.cambiar({ q: $event })"
        />
        <mat-form-field>
          <mat-label>Caben al menos</mat-label>
          <input
            matInput
            type="number"
            min="1"
            inputmode="numeric"
            [value]="f().capacidadMin || ''"
            (change)="capacidad('capacidadMin', $event)"
          />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Caben como máximo</mat-label>
          <input
            matInput
            type="number"
            min="1"
            inputmode="numeric"
            [value]="f().capacidadMax || ''"
            (change)="capacidad('capacidadMax', $event)"
          />
        </mat-form-field>
      }
    </div>

    @if (!f().estado) {
      <app-estado-vacio
        [icono]="iconos.Church"
        titulo="Elige un estado"
        descripcion="Después puedes acotar por municipio, ciudad, tipo, nombre o capacidad."
      />
    } @else if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="4" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (iglesias().length === 0) {
      <app-estado-vacio
        [icono]="iconos.Church"
        titulo="No hay iglesias con esos filtros"
        descripcion="Quita algún filtro para ver más iglesias del estado."
      />
    } @else {
      <section class="lista" aria-label="Iglesias del estado">
        @for (i of iglesias(); track i.id) {
          <app-tarjeta-iglesia
            [id]="i.id"
            [nombre]="i.nombre"
            [tipo]="i.tipo"
            [municipio]="i.municipio"
            [localidad]="i.localidad"
            [indice]="i.indice"
            [distincion]="i.distincion"
          />
        }
      </section>
      <app-paginacion
        [meta]="consulta.value()!.meta"
        (cambio)="filtros.cambiar({ page: $event })"
      />
    }
  `,
})
export class TemplosPage {
  private readonly servicio = inject(ExplorarService);

  protected readonly iconos = { Church };
  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_IGLESIA);
  protected readonly filtros = filtrosURL({
    estado: '',
    municipio: '',
    localidad: '',
    tipo: '',
    q: '',
    capacidadMin: 0,
    capacidadMax: 0,
    page: 1,
  });
  protected readonly f = this.filtros.valores;

  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      p.estado
        ? this.servicio.iglesias({
            estado: p.estado,
            municipio: p.municipio || undefined,
            localidad: p.localidad || undefined,
            tipo: (p.tipo || undefined) as TipoIglesia | undefined,
            q: p.q || undefined,
            capacidadMin: p.capacidadMin || undefined,
            capacidadMax: p.capacidadMax || undefined,
            page: p.page,
            limit: 20,
          })
        : of(null),
  });
  protected readonly iglesias = computed(() => valorDe(this.consulta)?.data ?? []);

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }

  protected capacidad(campo: 'capacidadMin' | 'capacidadMax', evento: Event) {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.filtros.cambiar({ [campo]: Number.isInteger(valor) && valor > 0 ? valor : 0 });
  }
}
