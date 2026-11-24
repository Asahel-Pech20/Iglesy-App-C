import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { format, startOfYear } from 'date-fns';
import { LineChart } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import {
  GraficaBarras,
  GraficaDona,
  type PuntoGrafica,
  TarjetaGrafica,
} from '@/app/compartido/graficas';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_AGRUPACION, etiquetaClave, opcionesDe } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import { BotonExportar } from '@/app/features/reportes/boton-exportar';
import type { AgrupacionIngresos } from '@/app/tipos/donaciones';
import { DonacionesService } from './donaciones.service';

/** Resumen de ingresos por periodo, concepto o método con gráfica y tabla (F4-04). */
@Component({
  selector: 'app-resumen-ingresos-tab',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    TarjetaGrafica,
    GraficaBarras,
    GraficaDona,
    BotonExportar,
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
          (change)="cambiarFecha('rdesde', $event)"
        />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Hasta</mat-label>
        <input
          matInput
          type="date"
          [value]="rango().hasta ?? ''"
          (change)="cambiarFecha('rhasta', $event)"
        />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="select-filtro">
        <mat-label>Agrupar por</mat-label>
        <mat-select [value]="agrupar()" (valueChange)="filtros.cambiar({ agrupar: $event })">
          @for (o of opciones; track o.valor) {
            <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="exportar">
        <app-boton-exportar tipo="ingresos" [filtros]="filtrosReporte()" />
      </div>
    </div>

    @if (consulta.isLoading() && !consulta.hasValue()) {
      <section class="tarjeta"><app-esqueleto [filas]="6" [columnas]="3" /></section>
    } @else if (consulta.error()) {
      <section class="tarjeta">
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      </section>
    } @else if (resumen(); as r) {
      @if (r.cantidad === 0) {
        <section class="tarjeta">
          <app-estado-vacio
            [icono]="iconoVacio"
            titulo="Sin ingresos en este periodo"
            descripcion="Prueba con otro rango de fechas."
          />
        </section>
      } @else {
        <div class="columna">
          <app-tarjeta-grafica
            [titulo]="'Ingresos por ' + etiquetaAgrupar().toLowerCase()"
            [descripcion]="
              'Total de ' + moneda.formato(r.total) + ' en ' + r.cantidad + ' aportaciones.'
            "
            [encabezados]="[etiquetaAgrupar(), 'Total']"
            [filas]="filasTabla()"
          >
            @if (porCategoria()) {
              <app-grafica-dona [datos]="puntos()" [formatoValor]="moneda.formato" />
            } @else {
              <app-grafica-barras [datos]="puntos()" [formatoValor]="moneda.formato" />
            }
          </app-tarjeta-grafica>

          <section class="tarjeta">
            <div class="contenedor-tabla">
              <table class="tabla-simple" aria-label="Resumen de ingresos">
                <thead>
                  <tr>
                    <th scope="col">{{ etiquetaAgrupar() }}</th>
                    <th scope="col" class="num">Aportaciones</th>
                    <th scope="col" class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of r.grupos; track g.clave) {
                    <tr>
                      <td class="nombre-colonial">{{ etiqueta(g.clave) }}</td>
                      <td class="num">{{ g.cantidad }}</td>
                      <td class="num">{{ moneda.formato(g.total) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td class="num">{{ r.cantidad }}</td>
                    <td class="num">{{ moneda.formato(r.total) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      }
    }
  `,
  styles: `
    .fecha {
      width: 10rem;
    }
    .exportar {
      margin-left: auto;
    }
    @media (max-width: 639px) {
      .fecha {
        width: 100%;
      }
      .exportar {
        margin-left: 0;
      }
    }
  `,
})
export class ResumenIngresosTab {
  private readonly servicio = inject(DonacionesService);
  protected readonly moneda = inject(FormatoMonedaService);

  // Claves propias (r…) para no mezclarse con los filtros del listado
  protected readonly filtros = filtrosURL({ rdesde: '', rhasta: '', agrupar: 'mes' });
  protected readonly opciones = opcionesDe(ETIQUETAS_AGRUPACION);
  protected readonly iconoVacio = LineChart;
  protected readonly etiqueta = etiquetaClave;

  protected readonly rango = computed(() => {
    const f = this.filtros.valores();
    const hoy = new Date();
    return !f.rdesde && !f.rhasta
      ? { desde: format(startOfYear(hoy), 'yyyy-MM-dd'), hasta: format(hoy, 'yyyy-MM-dd') }
      : { desde: f.rdesde || undefined, hasta: f.rhasta || undefined };
  });
  protected readonly agrupar = computed(() => this.filtros.valores().agrupar as AgrupacionIngresos);
  protected readonly etiquetaAgrupar = computed(() => ETIQUETAS_AGRUPACION[this.agrupar()]);
  protected readonly porCategoria = computed(
    () => this.agrupar() === 'concepto' || this.agrupar() === 'metodo',
  );
  protected readonly filtrosReporte = computed(() => ({
    ...this.rango(),
    agrupar: this.agrupar(),
  }));

  protected readonly consulta = rxResource({
    params: () => ({
      desde: this.rango().desde,
      hasta: this.rango().hasta,
      agrupar: this.agrupar(),
      version: this.servicio.version(),
    }),
    stream: ({ params: { version: _version, ...query } }) => this.servicio.resumenIngresos(query),
  });
  protected readonly resumen = computed(() => valorDe(this.consulta));

  // Solo para dibujar: los totales que se muestran en texto son los strings del backend
  protected readonly puntos = computed<PuntoGrafica[]>(() =>
    (this.resumen()?.grupos ?? [])
      .filter((g) => !this.porCategoria() || g.cantidad > 0)
      .map((g) => ({ etiqueta: etiquetaClave(g.clave), valor: Number(g.total) })),
  );
  protected readonly filasTabla = computed(() =>
    (this.resumen()?.grupos ?? []).map((g) => [
      etiquetaClave(g.clave),
      this.moneda.formato(g.total),
    ]),
  );

  protected cambiarFecha(clave: 'rdesde' | 'rhasta', evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.filtros.cambiar({
      rdesde: this.rango().desde ?? '',
      rhasta: this.rango().hasta ?? '',
      [clave]: valor,
    });
  }
}
