import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { of } from 'rxjs';
import { valorDe } from '@/app/core/recurso';
import { IglesiasService } from '@/app/features/iglesias/iglesias.service';
import type { Lugar } from '@/app/tipos/patrimonio';

/**
 * Estado → municipio → localidad del catálogo del INEGI (RF-01, RF-02, RF-20, RF-23).
 * Al cambiar un nivel se vacían los de abajo. Emite el lugar completo.
 */
@Component({
  selector: 'app-selector-lugar',
  imports: [MatFormField, MatLabel, MatSelect, MatOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: contents;
    }
    /* E2-14: etiquetas del estilo colonial; los campos conservan el contorno de Material (WCAG 1.4.11) */
    mat-form-field {
      width: 100%;
    }
    mat-label {
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--primario);
    }
  `,
  template: `
    <mat-form-field>
      <mat-label>Estado</mat-label>
      <mat-select [value]="estado() ?? ''" (selectionChange)="elegir({ estado: $event.value })">
        <mat-option value="">{{ textoSinEstado() }}</mat-option>
        @for (e of estados(); track e.clave) {
          <mat-option [value]="e.clave">{{ e.nombre }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    @if (estado()) {
      <mat-form-field>
        <mat-label>Municipio</mat-label>
        <mat-select
          [value]="municipio() ?? ''"
          (selectionChange)="elegir({ estado: estado(), municipio: $event.value })"
        >
          <mat-option value="">Todos</mat-option>
          @for (m of municipios(); track m.clave) {
            <mat-option [value]="m.clave">{{ m.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
    @if (municipio() && conLocalidad()) {
      <mat-form-field>
        <mat-label>Ciudad o localidad</mat-label>
        <mat-select
          [value]="localidad() ?? ''"
          (selectionChange)="
            elegir({ estado: estado(), municipio: municipio(), localidad: $event.value })
          "
        >
          <mat-option value="">Todas</mat-option>
          @for (l of localidades(); track l.clave) {
            <mat-option [value]="l.clave">{{ l.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    }
  `,
})
export class SelectorLugar {
  readonly estado = input<string | undefined>();
  readonly municipio = input<string | undefined>();
  readonly localidad = input<string | undefined>();
  readonly textoSinEstado = input('Todo el país');
  readonly conLocalidad = input(true);
  readonly cambio = output<Lugar>();

  private readonly servicio = inject(IglesiasService);
  private readonly catalogoEstados = rxResource({ stream: () => this.servicio.estados() });
  private readonly catalogoMunicipios = rxResource({
    params: () => this.estado(),
    stream: ({ params }) => (params ? this.servicio.municipios(params) : of(null)),
  });
  private readonly catalogoLocalidades = rxResource({
    params: () => this.municipio(),
    stream: ({ params }) => (params ? this.servicio.localidades(params) : of(null)),
  });
  protected readonly estados = computed(() => valorDe(this.catalogoEstados)?.data ?? []);
  protected readonly municipios = computed(() => valorDe(this.catalogoMunicipios)?.data ?? []);
  protected readonly localidades = computed(() => valorDe(this.catalogoLocalidades)?.data ?? []);

  protected elegir(lugar: Lugar) {
    this.cambio.emit({
      estado: lugar.estado || undefined,
      municipio: lugar.municipio || undefined,
      localidad: lugar.localidad || undefined,
    });
  }
}
