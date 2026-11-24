import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Coins } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { ETIQUETAS_METODO, formatearFecha } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import { DonacionesService } from './donaciones.service';
import { conceptoDe } from './formato-donacion';

/**
 * Pestaña "Aportaciones" del perfil de un miembro (F2-11). Solo se muestra a quien tiene
 * `donaciones:leer`; para los demás no renderiza nada ni pide datos financieros.
 * @example <app-aportaciones-del-miembro [miembroId]="miembro.id" />
 */
@Component({
  selector: 'app-aportaciones-del-miembro',
  imports: [RouterLink, BadgeEstado, EstadoError, EstadoVacio, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (permitido()) {
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="3" [columnas]="3" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos().length === 0) {
        <app-estado-vacio [icono]="iconoVacio" titulo="Este miembro aún no tiene aportaciones" />
      } @else {
        <div class="contenido">
          <p class="texto-suave">
            Total aportado: <strong class="total">{{ moneda.formato(totalMonto()) }}</strong> (sin
            anuladas)
          </p>
          <ul aria-label="Aportaciones del miembro" class="lista">
            @for (d of datos(); track d.id) {
              <li>
                <div class="datos">
                  <p [class.anulada]="d.anulada" [class.fuerte]="!d.anulada">{{ concepto(d) }}</p>
                  <p class="texto-suave detalle">{{ fecha(d.fecha) }} · {{ metodos[d.metodo] }}</p>
                </div>
                <div class="monto-fila">
                  @if (d.anulada) {
                    <app-badge-estado etiqueta="Anulada" variante="peligro" />
                  }
                  <span class="monto" [class.anulada]="d.anulada" [class.fuerte]="!d.anulada">{{
                    moneda.formato(d.monto)
                  }}</span>
                </div>
              </li>
            }
          </ul>
          @if (hayMas()) {
            <a routerLink="/donaciones" class="mas">Ver todas en Donaciones</a>
          }
        </div>
      }
    }
  `,
  styles: `
    .contenido {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    p {
      margin: 0;
    }
    .total {
      color: var(--texto);
    }
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
    }
    li + li {
      border-top: 1px solid var(--marco);
    }
    .datos {
      min-width: 0;
    }
    .detalle {
      font-size: 14px;
    }
    .monto-fila {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .monto {
      font-size: 18px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    p.fuerte {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    .anulada {
      color: var(--texto-suave);
      text-decoration: line-through;
    }
    .mas {
      font-size: 14px;
    }
  `,
})
export class AportacionesDelMiembro {
  readonly miembroId = input.required<string>();
  /** Cuántas mostrar (las más recientes); el resto se ve en /donaciones */
  readonly limite = input(10);

  private readonly sesion = inject(SesionService);
  private readonly servicio = inject(DonacionesService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly permitido = computed(() => this.sesion.puede('donaciones:leer'));
  protected readonly consulta = rxResource({
    // Sin permiso no se piden datos financieros
    params: () =>
      this.permitido()
        ? { miembroId: this.miembroId(), incluirAnuladas: true, limit: this.limite() }
        : undefined,
    stream: ({ params }) => this.servicio.listar(params),
  });
  protected readonly datos = computed(() => valorDe(this.consulta)?.data ?? []);
  protected readonly totalMonto = computed(() => valorDe(this.consulta)?.meta.totalMonto);
  protected readonly hayMas = computed(
    () => (valorDe(this.consulta)?.meta.total ?? 0) > this.datos().length,
  );

  protected readonly iconoVacio = Coins;
  protected readonly metodos = ETIQUETAS_METODO;
  protected readonly fecha = formatearFecha;
  protected readonly concepto = conceptoDe;
}
