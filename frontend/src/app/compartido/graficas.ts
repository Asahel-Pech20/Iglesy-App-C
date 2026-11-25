import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  type Signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { BarChart3, LucideAngularModule, Table2 } from 'lucide-angular';

// Gráficas hechas con HTML/CSS (sin librerías): los colores salen de los tokens de AGENTS.md §4,
// así que cambian solos en modo oscuro. Toda gráfica lleva descripción en texto y tabla alternativa.

export interface PuntoGrafica {
  etiqueta: string;
  valor: number;
}

export const COLORES_GRAFICA = [
  'var(--primario)',
  'var(--acento)',
  'var(--exito)',
  'var(--peligro)',
  'var(--texto-suave)',
];

const NUMERO = (v: number) => v.toLocaleString('es-MX');

let contador = 0;

/**
 * Tarjeta con título, descripción textual, la gráfica (contenido proyectado) y el interruptor
 * "Ver como tabla" (F4-07, accesibilidad: AGENTS.md §4).
 */
@Component({
  selector: 'app-tarjeta-grafica',
  imports: [MatButton, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta tarjeta-cuerpo">
      <div class="cabecera">
        <div class="textos">
          <h3 class="tarjeta-titulo" [id]="idTitulo">{{ titulo() }}</h3>
          <p class="texto-suave descripcion">{{ descripcion() }}</p>
        </div>
        @if (!vacio()) {
          <button
            matButton
            type="button"
            [attr.aria-pressed]="comoTabla()"
            [attr.aria-label]="
              (comoTabla() ? 'Ver como gráfica' : 'Ver como tabla') + ': ' + titulo()
            "
            (click)="comoTabla.set(!comoTabla())"
          >
            <lucide-icon
              [img]="comoTabla() ? iconoGrafica : iconoTabla"
              [size]="16"
              aria-hidden="true"
            />
            <span class="texto-boton">{{ comoTabla() ? 'Ver gráfica' : 'Ver como tabla' }}</span>
          </button>
        }
      </div>
      @if (vacio()) {
        <p class="texto-suave vacio">{{ vacio() }}</p>
      } @else if (comoTabla()) {
        <div class="tabla">
          <table class="tabla-simple" [attr.aria-label]="'Datos de ' + titulo()">
            <thead>
              <tr>
                @for (e of encabezados(); track e; let i = $index) {
                  <th scope="col" [class.num]="i > 0">{{ e }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (fila of filas(); track $index) {
                <tr>
                  @for (celda of fila; track $index; let c = $index) {
                    <td [class.num]="c > 0">{{ celda }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div role="img" [attr.aria-labelledby]="idTitulo" class="grafica">
          <ng-content />
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    .textos {
      min-width: 0;
    }
    .tarjeta-titulo {
      margin: 0;
    }
    .descripcion {
      margin: 4px 0 0;
      font-size: 14px;
    }
    .vacio {
      padding: 32px 0;
      text-align: center;
    }
    .tabla {
      max-height: 16rem;
      overflow: auto;
    }
    .grafica {
      width: 100%;
      min-height: 16rem;
    }
    @media (max-width: 639px) {
      .texto-boton {
        display: none;
      }
    }
  `,
})
export class TarjetaGrafica {
  readonly titulo = input.required<string>();
  /** Resumen en texto de lo que muestra la gráfica (también es su nombre accesible) */
  readonly descripcion = input.required<string>();
  readonly encabezados = input.required<string[]>();
  readonly filas = input.required<(string | number)[][]>();
  /** Mensaje cuando no hay datos que graficar */
  readonly vacio = input<string>();
  protected readonly comoTabla = signal(false);
  protected readonly idTitulo = `titulo-grafica-${++contador}`;
  protected readonly iconoTabla = Table2;
  protected readonly iconoGrafica = BarChart3;
}

/** Barras verticales u horizontales (etiquetas largas, p. ej. ministerios). */
@Component({
  selector: 'app-grafica-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (horizontal()) {
      <ul class="horizontal">
        @for (p of puntos(); track p.etiqueta) {
          <li [title]="p.etiqueta + ': ' + formatoValor()(p.valor)">
            <span class="etiqueta-h">{{ p.etiqueta }}</span>
            <span class="pista"
              ><span
                class="barra-h"
                [style.width.%]="porcentaje(p.valor)"
                [style.background]="color()"
              ></span
            ></span>
            <span class="valor">{{ formatoValor()(p.valor) }}</span>
          </li>
        }
      </ul>
    } @else {
      <div class="vertical">
        <span class="maximo">{{ formatoEjeFn()(maximo()) }}</span>
        <ul class="columnas">
          @for (p of puntos(); track p.etiqueta) {
            <li [title]="p.etiqueta + ': ' + formatoValor()(p.valor)">
              <span
                class="barra"
                [style.height.%]="porcentaje(p.valor)"
                [style.background]="color()"
              ></span>
              <span class="etiqueta">{{ p.etiqueta }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      font-size: 12px;
      color: var(--texto-suave);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .vertical {
      position: relative;
      padding-top: 16px;
    }
    .maximo {
      position: absolute;
      top: 0;
      left: 0;
    }
    .columnas {
      display: flex;
      height: 14rem;
      align-items: stretch;
      gap: 4px;
      border-bottom: 1px solid var(--marco);
      border-top: 1px dashed var(--marco);
    }
    .columnas li {
      position: relative;
      display: flex;
      min-width: 0;
      flex: 1;
      align-items: flex-end;
      justify-content: center;
    }
    .barra {
      display: block;
      width: 100%;
      max-width: 40px;
      min-height: 1px;
      border-radius: 4px 4px 0 0;
    }
    .etiqueta {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
    }
    .vertical {
      padding-bottom: 24px;
    }
    .horizontal {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .horizontal li {
      display: grid;
      grid-template-columns: minmax(80px, 110px) 1fr auto;
      align-items: center;
      gap: 8px;
    }
    .etiqueta-h {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--texto);
    }
    .pista {
      display: block;
      height: 16px;
      border-radius: 4px;
      background: var(--superficie-suave);
    }
    .barra-h {
      display: block;
      height: 100%;
      min-width: 1px;
      border-radius: 4px;
    }
    .valor {
      min-width: 2ch;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--texto);
    }
  `,
})
export class GraficaBarras {
  readonly datos = input.required<PuntoGrafica[]>();
  readonly horizontal = input(false);
  /** Formato del valor (tooltip y barras horizontales) */
  readonly formatoValor = input<(valor: number) => string>(NUMERO);
  /** Formato de la marca del eje (más corto que el tooltip; por defecto el mismo) */
  readonly formatoEje = input<((valor: number) => string) | undefined>();
  readonly color = input(COLORES_GRAFICA[0]);

  protected readonly puntos = computed(() => this.datos());
  protected readonly maximo = computed(() => Math.max(1, ...this.datos().map((p) => p.valor)));
  protected readonly formatoEjeFn: Signal<(valor: number) => string> = computed(
    () => this.formatoEje() ?? this.formatoValor(),
  );

  protected porcentaje(valor: number) {
    return Math.max(0, Math.min(100, (valor / this.maximo()) * 100));
  }
}

/** Dona con leyenda (conic-gradient). */
@Component({
  selector: 'app-grafica-dona',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="contenedor">
      <div class="dona" [style.background]="gradiente()" aria-hidden="true"></div>
      <ul aria-label="Leyenda">
        @for (p of datos(); track p.etiqueta; let i = $index) {
          <li>
            <span class="muestra" [style.background]="colorDe(i)" aria-hidden="true"></span>
            <span class="nombre">{{ p.etiqueta }}</span>
            <span class="valor">{{ formatoValor()(p.valor) }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .contenedor {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    @media (min-width: 640px) {
      .contenedor {
        flex-direction: row;
      }
    }
    .dona {
      position: relative;
      width: 10rem;
      height: 10rem;
      flex-shrink: 0;
      border-radius: 50%;
    }
    .dona::after {
      content: '';
      position: absolute;
      inset: 28%;
      border-radius: 50%;
      background: var(--superficie);
    }
    ul {
      display: flex;
      width: 100%;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .muestra {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      border-radius: 2px;
    }
    .nombre {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .valor {
      color: var(--texto-suave);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class GraficaDona {
  readonly datos = input.required<PuntoGrafica[]>();
  readonly formatoValor = input<(valor: number) => string>(NUMERO);

  protected colorDe(i: number) {
    return COLORES_GRAFICA[i % COLORES_GRAFICA.length];
  }

  protected readonly gradiente = computed(() => {
    const total = this.datos().reduce((s, p) => s + p.valor, 0);
    if (total <= 0) return 'var(--superficie-suave)';
    let acumulado = 0;
    const tramos = this.datos().map((p, i) => {
      const desde = (acumulado / total) * 360;
      acumulado += p.valor;
      return `${this.colorDe(i)} ${desde}deg ${(acumulado / total) * 360}deg`;
    });
    return `conic-gradient(${tramos.join(', ')})`;
  });
}
