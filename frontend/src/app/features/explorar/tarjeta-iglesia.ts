import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Award, LucideAngularModule } from 'lucide-angular';
import { ETIQUETAS_TIPO_IGLESIA, formatearIndice } from '@/app/core/formato';
import type { LugarInegi, TipoIglesia } from '@/app/tipos/iglesias';
import { fotoDeIglesia } from './fotos-iglesias';

/** Nivel de la distinción (RN-06) para elegir colores: la más alta resalta más. */
export type NivelDistincion = 'sobresaliente' | 'alto' | 'valor' | 'ninguna';

export function nivelDistincion(distincion: string | null): NivelDistincion {
  if (!distincion) return 'ninguna';
  if (/sobresaliente/i.test(distincion)) return 'sobresaliente';
  if (/alto/i.test(distincion)) return 'alto';
  return 'valor';
}

/**
 * Píldora de la distinción en el estilo colonial (E2-14): sobresaliente en dorado con ícono,
 * alto valor en azul, valor patrimonial con borde verde y sin distinción con borde --marco.
 */
@Component({
  selector: 'app-pildora-distincion',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
    }
    .sobresaliente {
      background: var(--acento);
      color: var(--acento-texto);
    }
    .alto {
      background: var(--primario);
      color: var(--primario-texto);
    }
    .valor {
      border-color: var(--exito);
      color: var(--texto);
    }
    .ninguna {
      border-color: var(--marco);
      color: var(--texto-suave);
    }
  `,
  template: `
    <span [class]="nivel()">
      @if (nivel() === 'sobresaliente') {
        <lucide-icon [img]="iconos.Award" [size]="14" aria-hidden="true" />
      }
      {{ distincion() ?? 'Sin distinción' }}
    </span>
  `,
})
export class PildoraDistincion {
  readonly distincion = input<string | null>(null);
  protected readonly nivel = computed(() => nivelDistincion(this.distincion()));
  protected readonly iconos = { Award };
}

/**
 * Tarjeta de una iglesia en las listas públicas (RF-18), en estilo colonial: doble marco, tipo en
 * mayúsculas pequeñas, nombre en serifa y el índice en Inter ligera con el color de su distinción.
 */
@Component({
  selector: 'app-tarjeta-iglesia',
  imports: [RouterLink, PildoraDistincion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: 4px;
    }
    article {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      height: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
    }
    .numero {
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .posicion {
      min-width: 2rem;
      font-size: 26px;
      color: var(--acento);
    }
    .cuerpo {
      flex: 1;
      min-width: 0;
    }
    .encabezado {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .tipo {
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--texto-suave);
    }
    .indice {
      font-size: 20px;
      white-space: nowrap;
    }
    .indice.sobresaliente {
      color: var(--acento);
    }
    .indice.alto {
      color: var(--primario);
    }
    .indice.valor {
      color: var(--exito);
    }
    .indice.ninguna {
      color: var(--texto-suave);
    }
    h3 {
      margin: 4px 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px;
      font-weight: 400;
      overflow-wrap: anywhere;
    }
    a {
      color: var(--primario);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .lugar {
      margin: 0 0 8px;
      color: var(--texto-suave);
      font-size: 13px;
    }
    /* Foto de la iglesia (solo las que tienen, ver fotos-iglesias.ts): ocupa todo el ancho arriba */
    figure {
      flex: 0 0 calc(100% + 28px);
      margin: -12px -14px 0;
    }
    figure img {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 4px 4px 0 0;
    }
    figcaption {
      padding: 4px 14px 0;
      font-size: 11px;
      color: var(--texto-suave);
    }
    figcaption a {
      color: inherit;
      text-decoration: underline;
    }
  `,
  template: `
    <article>
      @if (foto(); as f) {
        <figure>
          <img [src]="f.archivo" alt="" loading="lazy" width="1000" height="563" />
          <figcaption>
            Foto: <a [href]="f.enlace" target="_blank" rel="noopener noreferrer">{{ f.autor }}</a> ·
            <a [href]="f.licenciaUrl" target="_blank" rel="noopener noreferrer">{{ f.licencia }}</a>
          </figcaption>
        </figure>
      }
      @if (posicion()) {
        <span class="numero posicion" aria-label="Lugar en el ranking">{{ posicion() }}</span>
      }
      <div class="cuerpo">
        <div class="encabezado">
          <span class="tipo">{{ tipos[tipo()] }}</span>
          <span class="numero indice" [class]="nivel()">
            <span class="sr-only">Índice </span>{{ formato(indice()) }}
          </span>
        </div>
        <h3>
          <a [routerLink]="['/templos', id()]">{{ nombre() }}</a>
        </h3>
        <p class="lugar">{{ lugar() }}</p>
        <app-pildora-distincion [distincion]="distincion()" />
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
  protected readonly nivel = computed(() => nivelDistincion(this.distincion()));
  /** Foto de la iglesia, si la tiene (solo las iglesias reales de la demo). */
  protected readonly foto = computed(() => fotoDeIglesia(this.id()));
  protected readonly lugar = computed(
    () =>
      [this.localidad()?.nombre ?? this.municipio()?.nombre, this.estado()?.nombre]
        .filter(Boolean)
        .join(', ') || 'Sin ubicación',
  );
}
