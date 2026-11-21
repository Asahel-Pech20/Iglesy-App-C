import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Calculator, Church, Coins, Hash } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { GraficaBarras, type PuntoGrafica, TarjetaGrafica } from '@/app/compartido/graficas';
import { StatCard } from '@/app/compartido/stat-card';
import { filtrosURL } from '@/app/core/filtros-url';
import { formatearFecha } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import type { AgrupacionDiezmo } from '@/app/tipos/diezmo';
import { DiezmoService } from './diezmo.service';

const AGRUPACIONES: { valor: AgrupacionDiezmo; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'horario', etiqueta: 'Horario de misa' },
  { valor: 'padre', etiqueta: 'Padre' },
];

const fechaApi = (d: Date) => format(d, 'yyyy-MM-dd');

/** Resumen del periodo (total, promedio, misas con más y menos diezmo) y agrupaciones con gráfica y tabla. */
@Component({
  selector: 'app-reportes-diezmo-tab',
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
    StatCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros" role="search">
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Desde</mat-label>
        <input
          matInput
          type="date"
          [value]="rango().desde"
          (change)="cambiarFecha('rdesde', $event)"
        />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Hasta</mat-label>
        <input
          matInput
          type="date"
          [value]="rango().hasta"
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
    </div>

    @if (resumenRes.isLoading() && !resumenRes.hasValue()) {
      <section class="tarjeta"><app-esqueleto [filas]="4" [columnas]="3" /></section>
    } @else if (resumenRes.error()) {
      <section class="tarjeta">
        <app-estado-error [error]="resumenRes.error()" (reintentar)="recargar()" />
      </section>
    } @else if (resumen(); as r) {
      @if (r.misas === 0) {
        <section class="tarjeta">
          <app-estado-vacio
            [icono]="iconoVacio"
            titulo="Sin diezmo capturado en este periodo"
            descripcion="Prueba con otro rango de fechas."
          />
        </section>
      } @else {
        <div class="columna">
          <div class="tarjetas-resumen">
            <app-stat-card
              titulo="Total del periodo"
              [icono]="iconos.Coins"
              [valor]="moneda.formato(r.total)"
            />
            <app-stat-card
              titulo="Misas con diezmo"
              [icono]="iconos.Hash"
              [valor]="String(r.misas)"
            />
            <app-stat-card
              titulo="Promedio por misa"
              [icono]="iconos.Calculator"
              [valor]="moneda.formato(r.promedio)"
            />
          </div>

          <section class="tarjeta tarjeta-cuerpo extremos">
            <div>
              <h3>Misa con más diezmo</h3>
              @for (m of r.conMas; track m.misaId) {
                <p>
                  {{ fecha(m.fechaLocal) }} {{ m.horaLocal }} ·
                  <strong>{{ moneda.formato(m.monto) }}</strong>
                </p>
              }
            </div>
            <div>
              <h3>Misa con menos diezmo</h3>
              @for (m of r.conMenos; track m.misaId) {
                <p>
                  {{ fecha(m.fechaLocal) }} {{ m.horaLocal }} ·
                  <strong>{{ moneda.formato(m.monto) }}</strong>
                </p>
              }
            </div>
          </section>

          @if (agrupadoRes.error()) {
            <section class="tarjeta">
              <app-estado-error [error]="agrupadoRes.error()" (reintentar)="recargar()" />
            </section>
          } @else {
            <app-tarjeta-grafica
              [titulo]="'Diezmo por ' + etiquetaAgrupar().toLowerCase()"
              [descripcion]="'Total de ' + moneda.formato(r.total) + ' en ' + r.misas + ' misas.'"
              [encabezados]="[etiquetaAgrupar(), 'Misas', 'Total']"
              [filas]="filasTabla()"
              [vacio]="grupos().length === 0 ? 'Sin datos para graficar.' : undefined"
            >
              <app-grafica-barras
                [datos]="puntos()"
                [horizontal]="agrupar() === 'padre'"
                [formatoValor]="moneda.formato"
              />
            </app-tarjeta-grafica>
          }
        </div>
      }
    }
  `,
  styles: `
    .fecha {
      width: 10rem;
    }
    .tarjetas-resumen {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    }
    .extremos {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }
    .extremos h3,
    .extremos p {
      margin: 0 0 4px;
    }
    @media (max-width: 639px) {
      .fecha {
        width: 100%;
      }
    }
  `,
})
export class ReportesDiezmoTab {
  private readonly servicio = inject(DiezmoService);
  protected readonly moneda = inject(FormatoMonedaService);

  // Claves propias (r…) para no mezclarse con los filtros de la lista de misas
  protected readonly filtros = filtrosURL({ rdesde: '', rhasta: '', agrupar: 'mes' });
  protected readonly opciones = AGRUPACIONES;
  protected readonly fecha = formatearFecha;
  protected readonly iconoVacio = Church;
  protected readonly iconos = { Calculator, Coins, Hash };
  protected readonly String = String;

  /** Siempre explícito: mes en curso si la URL no trae rango */
  protected readonly rango = computed(() => {
    const f = this.filtros.valores();
    const hoy = new Date();
    return {
      desde: f.rdesde || fechaApi(startOfMonth(hoy)),
      hasta: f.rhasta || fechaApi(endOfMonth(hoy)),
    };
  });
  protected readonly agrupar = computed(() => this.filtros.valores().agrupar as AgrupacionDiezmo);
  protected readonly etiquetaAgrupar = computed(
    () => AGRUPACIONES.find((a) => a.valor === this.agrupar())?.etiqueta ?? '',
  );

  protected readonly resumenRes = rxResource({
    params: () => ({ ...this.rango(), version: this.servicio.version() }),
    stream: ({ params: { version: _version, ...periodo } }) => this.servicio.resumen(periodo),
  });
  protected readonly agrupadoRes = rxResource({
    params: () => ({ ...this.rango(), por: this.agrupar(), version: this.servicio.version() }),
    stream: ({ params: { version: _version, por, ...periodo } }) =>
      this.servicio.agrupado(periodo, por),
  });
  protected readonly resumen = computed(() => valorDe(this.resumenRes));
  protected readonly grupos = computed(() => valorDe(this.agrupadoRes)?.grupos ?? []);

  // Solo para dibujar: los totales que se muestran en texto son los strings del backend
  protected readonly puntos = computed<PuntoGrafica[]>(() =>
    this.grupos().map((g) => ({ etiqueta: g.etiqueta, valor: Number(g.total) })),
  );
  protected readonly filasTabla = computed(() =>
    this.grupos().map((g) => [g.etiqueta, g.misas, this.moneda.formato(g.total)]),
  );

  protected recargar() {
    this.resumenRes.reload();
    this.agrupadoRes.reload();
  }

  protected cambiarFecha(clave: 'rdesde' | 'rhasta', evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.filtros.cambiar({
      rdesde: this.rango().desde,
      rhasta: this.rango().hasta,
      [clave]: valor,
    });
  }
}
