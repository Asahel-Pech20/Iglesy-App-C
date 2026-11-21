import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { Church } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { formatearFecha } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { MisaCelebrada } from '@/app/tipos/diezmo';
import { DiezmoService } from './diezmo.service';

const fechaApi = (d: Date) => format(d, 'yyyy-MM-dd');

/** Misas celebradas del periodo con su diezmo; desde aquí se captura, corrige y consulta el historial. */
@Component({
  selector: 'app-misas-tab',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    PuedeDirective,
    BadgeEstado,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros" role="search">
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Desde</mat-label>
        <input
          matInput
          type="date"
          [value]="rango().desde ?? ''"
          (change)="cambiarFecha('desde', $event)"
        />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Hasta</mat-label>
        <input
          matInput
          type="date"
          [value]="rango().hasta ?? ''"
          (change)="cambiarFecha('hasta', $event)"
        />
      </mat-form-field>
      @for (p of presets(); track p.etiqueta) {
        <button
          matButton="tonal"
          type="button"
          (click)="filtros.cambiar({ desde: p.desde, hasta: p.hasta })"
        >
          {{ p.etiqueta }}
        </button>
      }
    </div>

    <section class="tarjeta">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="6" [columnas]="5" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="No hay misas en este periodo"
          descripcion="Cambia el rango de fechas o registra una misa celebrada."
        >
          <button
            *appPuede="'misas:registrar'"
            matButton="filled"
            type="button"
            (click)="registrar.emit()"
          >
            Registrar misa
          </button>
        </app-estado-vacio>
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Misas celebradas y su diezmo">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Hora</th>
                <th scope="col">Padre</th>
                <th scope="col" class="num">Diezmo</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (m of datos(); track m.id) {
                <tr>
                  <td>{{ fecha(m.fechaLocal) }}</td>
                  <td>{{ m.horaLocal }}</td>
                  <td>{{ m.padre.nombre }}</td>
                  <td class="num">
                    @if (m.diezmo; as d) {
                      {{ moneda.formato(d.monto) }}
                    } @else {
                      <app-badge-estado etiqueta="Sin captura" variante="alerta" />
                    }
                  </td>
                  <td class="acciones">
                    @if (m.diezmo) {
                      <button
                        *appPuede="'diezmo:capturar'"
                        matButton="outlined"
                        type="button"
                        [attr.aria-label]="
                          'Corregir diezmo de la misa del ' +
                          fecha(m.fechaLocal) +
                          ' ' +
                          m.horaLocal
                        "
                        (click)="capturar.emit(m)"
                      >
                        Corregir
                      </button>
                      <button
                        matButton="outlined"
                        type="button"
                        [attr.aria-label]="
                          'Ver historial de la misa del ' + fecha(m.fechaLocal) + ' ' + m.horaLocal
                        "
                        (click)="historial.emit(m)"
                      >
                        Historial
                      </button>
                    } @else {
                      <button
                        *appPuede="'diezmo:capturar'"
                        matButton="filled"
                        type="button"
                        [attr.aria-label]="
                          'Capturar diezmo de la misa del ' +
                          fecha(m.fechaLocal) +
                          ' ' +
                          m.horaLocal
                        "
                        (click)="capturar.emit(m)"
                      >
                        Capturar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-paginacion
          [meta]="consulta.value()!.meta"
          (cambio)="filtros.cambiar({ page: $event })"
        />
      }
    </section>
  `,
  styles: `
    .fecha {
      width: 10rem;
    }
    .acciones {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    @media (max-width: 639px) {
      .fecha {
        width: 100%;
      }
    }
  `,
})
export class MisasTab {
  readonly capturar = output<MisaCelebrada>();
  readonly historial = output<MisaCelebrada>();
  readonly registrar = output();

  private readonly servicio = inject(DiezmoService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly filtros = filtrosURL({ desde: '', hasta: '', page: 1 });
  protected readonly fecha = formatearFecha;
  protected readonly iconoVacio = Church;

  /** Sin rango en la URL, el mes en curso */
  protected readonly rango = computed(() => {
    const f = this.filtros.valores();
    const hoy = new Date();
    return !f.desde && !f.hasta
      ? { desde: fechaApi(startOfMonth(hoy)), hasta: fechaApi(hoy) }
      : { desde: f.desde || undefined, hasta: f.hasta || undefined };
  });

  protected readonly presets = computed(() => {
    const hoy = new Date();
    return [
      { etiqueta: 'Este mes', desde: fechaApi(startOfMonth(hoy)), hasta: fechaApi(hoy) },
      {
        etiqueta: 'Mes anterior',
        desde: fechaApi(startOfMonth(subMonths(hoy, 1))),
        hasta: fechaApi(endOfMonth(subMonths(hoy, 1))),
      },
    ];
  });

  protected readonly consulta = rxResource({
    params: () => ({
      desde: this.rango().desde,
      hasta: this.rango().hasta,
      page: this.filtros.valores().page,
      limit: 20,
      version: this.servicio.version(),
    }),
    stream: ({ params: { version: _version, ...query } }) => this.servicio.listarMisas(query),
  });
  protected readonly datos = computed(() => valorDe(this.consulta)?.data ?? []);

  protected cambiarFecha(clave: 'desde' | 'hasta', evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.filtros.cambiar({
      desde: this.rango().desde ?? '',
      hasta: this.rango().hasta ?? '',
      [clave]: valor,
    });
  }
}
