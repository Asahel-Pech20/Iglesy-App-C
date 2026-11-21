import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeEstado, type VarianteBadge } from '@/app/compartido/badge-estado';
import { ETIQUETAS_TIPO_IGLESIA, formatearIndice } from '@/app/core/formato';
import type { LugarInegi, TipoIglesia } from '@/app/tipos/iglesias';

/** Variante del badge según la distinción (RN-06): la más alta resalta más. */
export function varianteDistincion(distincion: string | null): VarianteBadge {
  if (!distincion) return 'neutro';
  if (/sobresaliente/i.test(distincion)) return 'primario';
  if (/alto/i.test(distincion)) return 'exito';
  return 'alerta';
}

/** Tarjeta de una iglesia en las listas públicas: nombre, tipo, lugar y distinción (RF-18). */
@Component({
  selector: 'app-tarjeta-iglesia',
  imports: [RouterLink, BadgeEstado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    article {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 16px;
    }
    .posicion {
      min-width: 2rem;
      font-size: 20px;
      font-weight: 700;
      color: var(--acento);
    }
    .cuerpo {
      flex: 1;
      min-width: 0;
    }
    h3 {
      margin: 0 0 4px;
      font-size: 16px;
      overflow-wrap: anywhere;
    }
    a {
      color: var(--primario);
    }
    .suave {
      margin: 0 0 6px;
      color: var(--texto-suave);
      font-size: 14px;
    }
    .indice {
      font-size: 14px;
      margin-left: 8px;
    }
  `,
  template: `
    <article class="tarjeta">
      @if (posicion()) {
        <span class="posicion" aria-label="Lugar en el ranking">{{ posicion() }}</span>
      }
      <div class="cuerpo">
        <h3>
          <a [routerLink]="['/templos', id()]">{{ nombre() }}</a>
        </h3>
        <p class="suave">{{ tipos[tipo()] }} · {{ lugar() }}</p>
        <app-badge-estado [etiqueta]="distincion() ?? 'Sin distinción'" [variante]="variante()" />
        <span class="indice">Índice {{ formato(indice()) }}</span>
        <ng-content />
      </div>
    </article>
  `,
})
export class TarjetaIglesia {
  readonly id = input.required<string>();
  readonly nombre = input.required<string>();
  readonly tipo = input.required<TipoIglesia>();
  readonly municipio = input<LugarInegi | null>(null);
  readonly localidad = input<LugarInegi | null>(null);
  readonly estado = input<LugarInegi | null>(null);
  readonly indice = input(0);
  readonly distincion = input<string | null>(null);
  readonly posicion = input<number | null>(null);

  protected readonly tipos = ETIQUETAS_TIPO_IGLESIA;
  protected readonly formato = formatearIndice;
  protected readonly variante = computed(() => varianteDistincion(this.distincion()));
  protected readonly lugar = computed(
    () =>
      [this.localidad()?.nombre ?? this.municipio()?.nombre, this.estado()?.nombre]
        .filter(Boolean)
        .join(', ') || 'Sin ubicación',
  );
}
