import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ban, CalendarX2, LucideAngularModule, MapPin } from 'lucide-angular';
import { BadgeEstado, type VarianteBadge } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import {
  ETIQUETAS_CATEGORIA_EVENTO,
  ETIQUETAS_ESTADO_EVENTO,
  formatearFechaHora,
} from '@/app/core/formato';
import type { CategoriaEvento, EstadoEvento, Evento } from '@/app/tipos/eventos';
import { ICONO_CATEGORIA } from './estilos';

const CATEGORIAS: CategoriaEvento[] = ['CULTO', 'REUNION', 'ACTIVIDAD', 'OTRO'];

/** Leyenda del calendario: color + ícono + texto de cada categoría y de "Cancelado". */
@Component({
  selector: 'app-leyenda-categorias',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul aria-label="Leyenda de categorías" class="leyenda">
      @for (c of categorias; track c) {
        <li>
          <span class="marca" [class]="'marca cat-' + c">
            <lucide-icon [img]="iconos[c]" [size]="14" aria-hidden="true" />
          </span>
          {{ etiquetas[c] }}
        </li>
      }
      <li>
        <span class="marca cat-CANCELADO">
          <lucide-icon [img]="iconoCancelado" [size]="14" aria-hidden="true" />
        </span>
        <span class="tachado">Cancelado</span>
      </li>
    </ul>
  `,
  styles: `
    .leyenda {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .marca {
      display: inline-flex;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .tachado {
      text-decoration: line-through;
    }
  `,
})
export class LeyendaCategorias {
  protected readonly categorias = CATEGORIAS;
  protected readonly iconos = ICONO_CATEGORIA;
  protected readonly etiquetas = ETIQUETAS_CATEGORIA_EVENTO;
  protected readonly iconoCancelado = Ban;
}

const VARIANTE_ESTADO: Record<EstadoEvento, VarianteBadge> = {
  PROGRAMADO: 'primario',
  REALIZADO: 'exito',
  CANCELADO: 'peligro',
};

@Component({
  selector: 'app-badge-estado-evento',
  imports: [BadgeEstado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-badge-estado [etiqueta]="etiqueta()" [variante]="variante()" />`,
})
export class BadgeEstadoEvento {
  readonly estado = input.required<EstadoEvento>();
  protected readonly etiqueta = computed(() => ETIQUETAS_ESTADO_EVENTO[this.estado()]);
  protected readonly variante = computed(() => VARIANTE_ESTADO[this.estado()]);
}

/**
 * Lista compacta de eventos (enlace al detalle). La usan el dashboard (F4), las actividades del
 * ministerio (F2-11) y la pantalla de asistencia.
 * @example <app-lista-eventos [eventos]="proximos.value()" [cargando]="proximos.isLoading()" />
 */
@Component({
  selector: 'app-lista-eventos',
  imports: [
    RouterLink,
    LucideAngularModule,
    EstadoVacio,
    EstadoError,
    Esqueleto,
    BadgeEstadoEvento,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cargando()) {
      <app-esqueleto [filas]="3" [columnas]="2" />
    } @else if (error()) {
      <app-estado-error [error]="error()" (reintentar)="reintentar.emit()" />
    } @else if (!eventos()?.length) {
      <app-estado-vacio [icono]="iconoVacio" [titulo]="vacio()" />
    } @else {
      <ul [attr.aria-label]="etiqueta()" class="lista">
        @for (e of eventos(); track e.id) {
          <li class="evento">
            <span
              class="icono"
              [class]="
                'icono ' + (e.estado === 'CANCELADO' ? 'cat-CANCELADO' : 'cat-' + e.categoria)
              "
            >
              <lucide-icon [img]="iconos[e.categoria]" [size]="16" aria-hidden="true" />
            </span>
            <div class="cuerpo">
              <a
                [routerLink]="['/eventos', e.id]"
                class="titulo"
                [class.tachado]="e.estado === 'CANCELADO'"
                >{{ e.titulo }}</a
              >
              <p class="texto-suave">
                {{ fechaHora(e.fechaInicio) }}{{ e.ministerio ? ' · ' + e.ministerio.nombre : '' }}
              </p>
              <p class="texto-suave lugar">
                <lucide-icon [img]="iconoLugar" [size]="14" aria-hidden="true" /> {{ e.lugar }}
              </p>
            </div>
            @if (conEstado()) {
              <app-badge-estado-evento [estado]="e.estado" />
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .evento {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
    }
    .evento + .evento {
      border-top: 1px solid var(--marco);
    }
    .icono {
      display: inline-flex;
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
      border-radius: 8px;
    }
    .cuerpo {
      min-width: 0;
      flex: 1;
    }
    .cuerpo p {
      margin: 0;
      font-size: 14px;
    }
    .titulo {
      font-weight: 500;
      color: inherit;
    }
    .titulo:hover {
      text-decoration: underline;
    }
    .tachado {
      text-decoration: line-through;
    }
    .lugar {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class ListaEventos {
  readonly eventos = input<Evento[] | undefined>();
  readonly cargando = input(false);
  readonly error = input<unknown>();
  readonly vacio = input('No hay eventos.');
  /** Muestra el badge de estado (Programado / Realizado / Cancelado) */
  readonly conEstado = input(false);
  readonly etiqueta = input('Eventos');
  readonly reintentar = output();
  protected readonly iconos = ICONO_CATEGORIA;
  protected readonly iconoVacio = CalendarX2;
  protected readonly iconoLugar = MapPin;
  protected readonly fechaHora = formatearFechaHora;
}
