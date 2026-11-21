import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { LucideAngularModule, Search } from 'lucide-angular';
import { of } from 'rxjs';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_OBJETO, opcionesDe } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import type { Lugar, TipoObjeto } from '@/app/tipos/patrimonio';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { TarjetaIglesia } from './tarjeta-iglesia';

/**
 * /busqueda-patrimonio — el investigador elige un tipo de objeto, una antigüedad mínima y un lugar
 * y ve las iglesias abiertas con al menos un objeto vigente que cumple (E2-14: RF-23, CA-08).
 */
@Component({
  selector: 'app-busqueda-patrimonio',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
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
      gap: 8px 12px;
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
    ul {
      margin: 8px 0 0;
      padding-left: 20px;
      font-size: 14px;
    }
  `,
  template: `
    <h1>Búsqueda por patrimonio</h1>
    <p class="suave">Por ejemplo: imágenes de 300 años o más en Puebla.</p>
    <div class="filtros">
      <mat-form-field>
        <mat-label>Tipo de objeto</mat-label>
        <mat-select
          [value]="f().tipoObjeto"
          (selectionChange)="filtros.cambiar({ tipoObjeto: $event.value })"
        >
          @for (t of tipos; track t.valor) {
            <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Antigüedad mínima (años)</mat-label>
        <input
          matInput
          type="number"
          min="0"
          inputmode="numeric"
          [value]="f().antiguedadMin"
          (change)="antiguedad($event)"
        />
      </mat-form-field>
      <app-selector-lugar
        textoSinEstado="Elige un estado"
        [estado]="f().estado || undefined"
        [municipio]="f().municipio || undefined"
        [localidad]="f().localidad || undefined"
        (cambio)="lugar($event)"
      />
    </div>

    @if (!listo()) {
      <app-estado-vacio
        [icono]="iconos.Search"
        titulo="Elige qué buscar y dónde"
        descripcion="Un tipo de objeto, cuántos años como mínimo y un estado, municipio o ciudad."
      />
    } @else if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="3" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (resultados().length === 0) {
      <app-estado-vacio
        [icono]="iconos.Search"
        titulo="Ninguna iglesia cumple"
        descripcion="Prueba con menos años o con otro lugar."
      />
    } @else {
      <section class="lista" aria-label="Iglesias encontradas">
        @for (r of resultados(); track r.id) {
          <app-tarjeta-iglesia
            [id]="r.id"
            [nombre]="r.nombre"
            [tipo]="r.tipo"
            [estado]="r.estado"
            [municipio]="r.municipio"
            [localidad]="r.localidad"
            [indice]="r.indice"
            [distincion]="r.distincion"
          >
            <ul aria-label="Objetos que cumplen">
              @for (o of r.objetos; track o.id) {
                <li>{{ o.descripcion }} ({{ o.epoca }}, {{ o.antiguedad }} años)</li>
              }
            </ul>
          </app-tarjeta-iglesia>
        }
      </section>
      <app-paginacion
        [meta]="consulta.value()!.meta"
        (cambio)="filtros.cambiar({ page: $event })"
      />
    }
  `,
})
export class BusquedaPage {
  private readonly servicio = inject(ExplorarService);
  protected readonly iconos = { Search };
  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_OBJETO);
  protected readonly filtros = filtrosURL({
    tipoObjeto: 'IMAGEN',
    antiguedadMin: 300,
    estado: '',
    municipio: '',
    localidad: '',
    page: 1,
  });
  protected readonly f = this.filtros.valores;
  protected readonly listo = computed(() => Boolean(this.f().estado));

  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      p.estado
        ? this.servicio.busqueda({
            tipoObjeto: p.tipoObjeto as TipoObjeto,
            antiguedadMin: p.antiguedadMin,
            ...(p.localidad
              ? { localidad: p.localidad }
              : p.municipio
                ? { municipio: p.municipio }
                : { estado: p.estado }),
            page: p.page,
            limit: 20,
          })
        : of(null),
  });
  protected readonly resultados = computed(() => valorDe(this.consulta)?.data ?? []);

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }

  protected antiguedad(evento: Event) {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.filtros.cambiar({ antiguedadMin: Number.isInteger(valor) && valor >= 0 ? valor : 0 });
  }
}
