import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { DIAS_SEMANA, formatearFecha, formatearMoneda } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import {
  describirCosto,
  describirDuracion,
  describirHorarios,
  ETIQUETAS_IDIOMA,
  ETIQUETAS_TIPO_MISA,
  ETIQUETAS_TIPO_PLATICA,
} from '@/app/features/misas/formato-misas';
import { MisasService } from '@/app/features/misas/misas.service';
import type { IdiomaMisa } from '@/app/tipos/misas';
import type {
  MisaPublica,
  PlaticaPublica,
  ServicioPublico,
  TipoPlatica,
} from '@/app/tipos/servicios';
import { TituloColonial } from './explorar-layout';

/**
 * Secciones de la ficha pública que vienen de Genaro (E3-18): horario de misas con su padre
 * (RF-44, RF-52), servicios (RF-35) y pláticas, con «¿cuándo son las pláticas de…?» (RF-38, RF-39).
 * Las horas son las locales de la iglesia, sin convertirlas a la de quien consulta.
 */
@Component({
  selector: 'app-misas-servicios-ficha',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, TituloColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (misas().length > 0) {
      <section aria-labelledby="titulo-misas" class="bloque">
        <app-titulo-colonial texto="Horario de misas" [nivel]="2" idTitulo="titulo-misas" />
        <p class="suave centro">Hora local de la iglesia.</p>
        <!-- E3-25 (supuesto P-33): días sin misa u otra hora en los próximos 60 días -->
        @if (cambios().length > 0) {
          <div class="marco cambios" role="note" aria-labelledby="titulo-cambios">
            <h3 id="titulo-cambios">Cambios al horario</h3>
            <ul>
              @for (c of cambios(); track c.fecha + c.hora) {
                <li>
                  <strong>{{ dias[c.diaSemana] }} {{ fecha(c.fecha) }}, {{ c.hora }}:</strong>
                  {{ c.tipo === 'SIN_MISA' ? 'no hay misa' : 'la misa será a las ' + c.horaNueva }}.
                  <span class="suave">{{ c.motivo }}</span>
                </li>
              }
            </ul>
          </div>
        }
        <div class="dias">
          @for (d of misasPorDia(); track d.dia) {
            <div class="marco dia">
              <h3>{{ dias[d.dia] }}</h3>
              <ul>
                @for (m of d.misas; track $index) {
                  <li>
                    <span class="hora">{{ m.hora }}</span>
                    <span>
                      {{ m.padre }}
                      <span class="suave">
                        · {{ tiposMisa[m.tipo] }}
                        @if (m.idioma !== 'ESPANOL') {
                          · en {{ idioma(m.idioma) }}
                        }
                        @if (m.duracionMin !== null) {
                          · {{ duracion(m.duracionMin) }}
                        }
                      </span>
                    </span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </section>
    }

    @if (servicios().length > 0) {
      <section aria-labelledby="titulo-servicios" class="bloque">
        <app-titulo-colonial texto="Servicios" [nivel]="2" idTitulo="titulo-servicios" />
        <ul class="tarjetas">
          @for (s of servicios(); track s.nombre) {
            <li class="marco">
              <h3>{{ s.nombre }}</h3>
              <p class="costo">{{ costo(s) }}</p>
              <dl>
                @if (s.requisitos) {
                  <dt>Requisitos</dt>
                  <dd>{{ s.requisitos }}</dd>
                }
                @if (s.duracionMin !== null) {
                  <dt>Duración</dt>
                  <dd>{{ duracion(s.duracionMin) }}</dd>
                }
                <dt>Cuándo</dt>
                <dd>
                  {{ horarios(s.horarios) || 'Se acuerda al pedir la cita' }}
                  @if (s.requiereCita) {
                    <span class="suave"> · requiere cita</span>
                  }
                </dd>
              </dl>
            </li>
          }
        </ul>
      </section>
    }

    @if (platicas().length > 0) {
      <section aria-labelledby="titulo-platicas" class="bloque">
        <app-titulo-colonial texto="Pláticas" [nivel]="2" idTitulo="titulo-platicas" />
        <mat-form-field class="filtro" subscriptSizing="dynamic">
          <mat-label>¿Cuándo son las pláticas de…?</mat-label>
          <mat-select [value]="tipo()" (valueChange)="tipo.set($event)">
            <mat-option [value]="null">Todas</mat-option>
            @for (t of tiposDisponibles(); track t) {
              <mat-option [value]="t">{{ tiposPlatica[t] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <ul class="tarjetas" aria-live="polite">
          @for (p of platicasFiltradas(); track $index) {
            <li class="marco">
              <h3>{{ tiposPlatica[p.tipo] }}</h3>
              <p class="costo">{{ horarios(p.horarios) }}</p>
              <dl>
                <dt>Sesiones</dt>
                <dd>{{ p.sesiones }}</dd>
                <dt>Costo</dt>
                <dd>{{ costoPlatica(p) }}</dd>
                <dt>Cupo</dt>
                <dd>{{ p.cupo }} personas</dd>
                <dt>Dónde</dt>
                <dd>{{ p.lugar }}</dd>
                <dt>La da</dt>
                <dd>{{ p.imparte }}</dd>
              </dl>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    /* El mismo doble marco colonial de la ficha (ficha.page.ts) */
    .marco {
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      margin: 4px;
    }
    .cambios {
      margin: 0 auto 16px;
      max-width: 40rem;
    }
    .cambios h3 {
      margin: 0 0 8px;
    }
    .cambios ul {
      margin: 0;
      padding-left: 20px;
    }
    .bloque {
      margin-top: 24px;
    }
    .centro {
      text-align: center;
    }
    .suave {
      color: var(--texto-suave);
    }
    .dias {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 12px;
    }
    .dia {
      padding: 12px 14px;
    }
    h3 {
      margin: 0 0 6px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      font-weight: 400;
      color: var(--primario);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .dia li {
      display: flex;
      gap: 8px;
      padding: 2px 0;
    }
    .hora {
      min-width: 3rem;
      font-weight: 500;
    }
    .tarjetas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 12px;
    }
    .tarjetas li {
      padding: 12px 14px;
    }
    .costo {
      margin: 0 0 8px;
      font-weight: 500;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 8px;
      margin: 0;
      font-size: 13px;
    }
    dt {
      color: var(--texto-suave);
    }
    dd {
      margin: 0;
    }
    .filtro {
      width: min(100%, 22rem);
      margin-bottom: 12px;
    }
  `,
})
export class MisasServiciosFicha {
  readonly misas = input<MisaPublica[]>([]);
  readonly servicios = input<ServicioPublico[]>([]);
  readonly platicas = input<PlaticaPublica[]>([]);
  readonly moneda = input('MXN');
  /** Para consultar los cambios al horario (E3-25); sin él, la sección no aparece */
  readonly iglesiaId = input<string | null>(null);

  private readonly misasService = inject(MisasService);
  private readonly consultaCambios = rxResource({
    params: () => this.iglesiaId(),
    stream: ({ params }) => (params ? this.misasService.excepcionesPublicas(params) : of(null)),
  });
  protected readonly cambios = computed(() => valorDe(this.consultaCambios)?.excepciones ?? []);
  protected readonly fecha = formatearFecha;

  protected readonly dias = DIAS_SEMANA;
  protected readonly tiposMisa = ETIQUETAS_TIPO_MISA;
  protected readonly tiposPlatica = ETIQUETAS_TIPO_PLATICA;
  protected readonly horarios = describirHorarios;
  protected readonly duracion = (m: number | null) => describirDuracion(m);
  protected readonly tipo = signal<TipoPlatica | null>(null);

  protected idioma(i: string) {
    return (ETIQUETAS_IDIOMA[i as IdiomaMisa] ?? i).toLowerCase();
  }

  protected readonly misasPorDia = computed(() => {
    const grupos: { dia: number; misas: MisaPublica[] }[] = [];
    for (const m of this.misas()) {
      const g = grupos.find((x) => x.dia === m.diaSemana);
      if (g) g.misas.push(m);
      else grupos.push({ dia: m.diaSemana, misas: [m] });
    }
    return grupos;
  });

  protected readonly tiposDisponibles = computed(() => [
    ...new Set(this.platicas().map((p) => p.tipo)),
  ]);
  protected readonly platicasFiltradas = computed(() => {
    const t = this.tipo();
    return t ? this.platicas().filter((p) => p.tipo === t) : this.platicas();
  });

  protected costo(s: ServicioPublico) {
    return describirCosto(s.formaCosto, s.monto, this.moneda());
  }

  protected costoPlatica(p: PlaticaPublica) {
    return Number(p.costo) === 0 ? 'Gratuita' : formatearMoneda(p.costo, this.moneda());
  }
}
