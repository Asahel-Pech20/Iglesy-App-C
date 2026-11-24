import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FileSearch } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import type { Celda, Reporte, SeccionReporte, TipoColumna } from '@/app/tipos/reportes';
import { formatearCelda, MAX_FILAS_VISTA } from './formato-celda';

/**
 * Vista previa genérica de cualquier `Reporte` (los cuatro tienen el mismo formato): filtros
 * aplicados, cifras clave y una tabla por sección con su fila de totales (F4-10).
 */
@Component({
  selector: 'app-vista-previa-reporte',
  imports: [EstadoError, EstadoVacio, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cargando()) {
      <section class="tarjeta"><app-esqueleto [filas]="6" [columnas]="4" /></section>
    } @else if (error() || !reporte()) {
      <section class="tarjeta">
        <app-estado-error [error]="error()" (reintentar)="reintentar.emit()" />
      </section>
    } @else {
      @let r = reporte()!;
      <div class="columna" role="region" [attr.aria-label]="'Vista previa: ' + r.titulo">
        <section class="tarjeta tarjeta-cuerpo">
          <h2 class="tarjeta-titulo">{{ r.titulo }}</h2>
          @if (r.subtitulo) {
            <p class="texto-suave">{{ r.subtitulo }}</p>
          }
          @if (r.filtros.length > 0) {
            <p class="texto-suave">{{ filtrosTexto() }}</p>
          }
          @if (r.resumen.length > 0) {
            <dl class="resumen">
              @for (d of r.resumen; track d.etiqueta) {
                <div class="dato">
                  <dt>{{ d.etiqueta }}</dt>
                  <dd>{{ celda(d.valor, d.tipo) }}</dd>
                </div>
              }
            </dl>
          }
        </section>

        @for (seccion of r.secciones; track seccion.titulo) {
          <section class="tarjeta">
            <h3 class="titulo-seccion">{{ seccion.titulo }}</h3>
            @if (seccion.filas.length === 0) {
              <app-estado-vacio [icono]="iconoVacio" titulo="Sin datos para estos filtros" />
            } @else {
              <div class="contenedor-tabla">
                <table class="tabla-simple" [attr.aria-label]="seccion.titulo">
                  <thead>
                    <tr>
                      @for (c of seccion.columnas; track c.clave) {
                        <th scope="col" [class.num]="alineada(c.tipo)">{{ c.titulo }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of visibles(seccion); track $index) {
                      <tr>
                        @for (c of seccion.columnas; track c.clave) {
                          <td [class.num]="alineada(c.tipo)">{{ celda(fila[c.clave], c.tipo) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (seccion.filas.length > maxFilas) {
                <p class="texto-suave pie">
                  Mostrando las primeras {{ maxFilas }} de {{ total(seccion) }} filas. Descarga el
                  archivo para verlas todas.
                </p>
              }
              @if (seccion.totales; as totales) {
                <dl class="totales" [attr.aria-label]="'Totales de ' + seccion.titulo">
                  @for (c of seccion.columnas; track c.clave) {
                    @if (totales[c.clave] !== undefined && totales[c.clave] !== null) {
                      <div>
                        <dt>{{ c.titulo }}:</dt>
                        <dd>{{ celda(totales[c.clave], c.tipo) }}</dd>
                      </div>
                    }
                  }
                </dl>
              }
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .resumen {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 12px 0 0;
    }
    @media (min-width: 640px) {
      .resumen {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .dato {
      padding: 12px;
      border-radius: 8px;
      background: var(--superficie-suave);
    }
    .dato dt {
      font-size: 12px;
      color: var(--texto-suave);
    }
    .dato dd {
      margin: 4px 0 0;
      font-size: 18px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      font-variant-numeric: tabular-nums;
    }
    .titulo-seccion {
      margin: 0;
      padding: 16px 16px 8px;
      font-size: 16px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    .pie {
      margin: 0;
      padding: 12px 16px;
      border-top: 1px solid var(--marco);
      font-size: 14px;
    }
    .totales {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 24px;
      margin: 0;
      padding: 12px 16px;
      border-top: 1px solid var(--marco);
      background: var(--superficie-suave);
      font-size: 14px;
      font-weight: 600;
    }
    .totales div {
      display: flex;
      gap: 8px;
    }
    .totales dt {
      font-weight: 400;
      color: var(--texto-suave);
    }
    .totales dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class VistaPreviaReporte {
  readonly reporte = input<Reporte | undefined>();
  readonly cargando = input(false);
  readonly error = input<unknown>();
  readonly reintentar = output();

  private readonly moneda = inject(FormatoMonedaService);
  protected readonly maxFilas = MAX_FILAS_VISTA;
  protected readonly iconoVacio = FileSearch;

  protected readonly filtrosTexto = computed(() =>
    (this.reporte()?.filtros ?? [])
      .map((f) => `${f.etiqueta}: ${this.celda(f.valor, f.tipo)}`)
      .join(' · '),
  );

  protected celda(valor: Celda | undefined, tipo: TipoColumna | undefined) {
    return formatearCelda(valor, tipo, this.moneda.formato);
  }

  protected alineada(tipo?: TipoColumna) {
    return Boolean(tipo && tipo !== 'texto' && tipo !== 'fecha' && tipo !== 'fechaHora');
  }

  protected visibles(seccion: SeccionReporte) {
    return seccion.filas.slice(0, MAX_FILAS_VISTA);
  }

  protected total(seccion: SeccionReporte) {
    return seccion.filas.length.toLocaleString('es-MX');
  }
}
