import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { CalendarDays, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { DIAS_SEMANA, formatearFecha } from '@/app/core/formato';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import type { MisaAgenda } from '@/app/tipos/misas';
import {
  describirDuracion,
  ETIQUETAS_IDIOMA,
  ETIQUETAS_TIPO_MISA,
  nombrePadre,
} from './formato-misas';
import { MisasService } from './misas.service';

const sumarDias = (fecha: string, dias: number) =>
  new Date(new Date(`${fecha}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

/**
 * /padres/:padreId/agenda — todas las misas de un padre en la semana, de todas las iglesias donde
 * celebra, en la hora local de cada una (E3-16: RF-47; supuesto P-18: Coordinación y personal).
 */
@Component({
  selector: 'app-agenda-padre',
  imports: [MatButton, LucideAngularModule, PageHeader, EstadoError, EstadoVacio, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [titulo]="titulo()"
      descripcion="Agenda semanal: sus misas en todas las iglesias donde celebra, en la hora local de cada una."
    />
    <section class="tarjeta">
      @if (agenda(); as a) {
        <nav class="semana" aria-label="Semana">
          <button matButton="outlined" type="button" (click)="moverSemana(a.semana.desde, -7)">
            Semana anterior
          </button>
          <strong>Del {{ fecha(a.semana.desde) }} al {{ fecha(a.semana.hasta) }}</strong>
          <button matButton="outlined" type="button" (click)="moverSemana(a.semana.desde, 7)">
            Semana siguiente
          </button>
        </nav>
      }
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (porDia().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="Sin misas esta semana"
          descripcion="Este padre no tiene misas en el horario de ninguna iglesia abierta."
        />
      } @else {
        @for (d of porDia(); track d.fecha) {
          <h2 class="dia">{{ dias[d.diaSemana] }} {{ fecha(d.fecha) }}</h2>
          <ul class="misas" [attr.aria-label]="'Misas del ' + dias[d.diaSemana]">
            @for (m of d.misas; track m.horarioId) {
              <li>
                <span class="hora num">{{ m.hora }}</span>
                <span>
                  <strong>{{ m.iglesia.nombre }}</strong>
                  <span class="texto-suave">
                    · {{ tipos[m.tipo] }} · {{ idiomas[m.idioma] }} · {{ duracion(m.duracionMin) }}
                  </span>
                </span>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    .semana {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .dia {
      margin: 16px 0 8px;
      font-size: 16px;
      font-weight: 500;
    }
    .misas {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .misas li {
      display: flex;
      gap: 12px;
      align-items: baseline;
    }
    .hora {
      min-width: 3.5rem;
      font-weight: 500;
    }
  `,
})
export class AgendaPadrePage {
  readonly padreId = input.required<string>();
  private readonly servicio = inject(MisasService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly tipos = ETIQUETAS_TIPO_MISA;
  protected readonly idiomas = ETIQUETAS_IDIOMA;
  protected readonly fecha = formatearFecha;
  protected readonly duracion = (m: number | null) => describirDuracion(m);
  protected readonly iconoVacio = CalendarDays;

  protected readonly filtros = filtrosURL({ semana: '' });

  protected readonly consulta = rxResource({
    params: () => ({ padreId: this.padreId(), semana: this.filtros.valores().semana }),
    stream: ({ params }) => this.servicio.agenda(params.padreId, params.semana || undefined),
  });
  protected readonly agenda = computed(() => valorDe(this.consulta));
  protected readonly titulo = computed(() => {
    const p = this.agenda()?.padre;
    return p ? `Agenda de ${nombrePadre(p)}` : 'Agenda del padre';
  });

  /** Misas agrupadas por fecha, ya ordenadas por el momento real desde el servidor */
  protected readonly porDia = computed(() => {
    const grupos: { fecha: string; diaSemana: number; misas: MisaAgenda[] }[] = [];
    for (const m of this.agenda()?.misas ?? []) {
      const grupo = grupos.find((g) => g.fecha === m.fecha);
      if (grupo) grupo.misas.push(m);
      else grupos.push({ fecha: m.fecha, diaSemana: m.diaSemana, misas: [m] });
    }
    return grupos;
  });

  protected moverSemana(desde: string, dias: number) {
    this.filtros.cambiar({ semana: sumarDias(desde, dias) });
  }
}
