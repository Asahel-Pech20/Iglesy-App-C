import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { BarChart3, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import { BotonExportar } from '@/app/features/reportes/boton-exportar';
import { PermisosMinisterioService } from '@/app/features/eventos/permisos-ministerio.service';
import { MinisteriosService } from '@/app/features/ministerios/ministerios.service';
import type { PeriodoResumen } from '@/app/tipos/asistencia';
import { AsistenciaService } from './asistencia.service';

export interface FiltrosResumen {
  periodo: string;
  desde: string;
  hasta: string;
  ministerioId: string;
}

/** "2026-W43" → "Sem 43 (2026)"; "2026-10" → "oct 2026" */
function etiquetaPeriodo(periodo: string) {
  const semana = /^(\d{4})-W(\d{2})$/.exec(periodo);
  if (semana) return `Sem ${Number(semana[2])} (${semana[1]})`;
  return new Date(`${periodo}-01T00:00:00`).toLocaleDateString('es-MX', {
    month: 'short',
    year: 'numeric',
  });
}

/** Gráfica de presentes vs. ausentes + tabla accesible equivalente (F3-09). */
@Component({
  selector: 'app-resumen-asistencia',
  imports: [
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    BotonExportar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros">
      <mat-button-toggle-group
        aria-label="Periodo"
        hideSingleSelectionIndicator
        [value]="periodo()"
        (change)="cambio.emit({ periodo: $event.value })"
      >
        <mat-button-toggle value="semanal">Semanal</mat-button-toggle>
        <mat-button-toggle value="mensual">Mensual</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Desde</mat-label>
        <input matInput type="date" [value]="filtros().desde" (change)="fecha('desde', $event)" />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="fecha">
        <mat-label>Hasta</mat-label>
        <input matInput type="date" [value]="filtros().hasta" (change)="fecha('hasta', $event)" />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic" class="select-filtro">
        <mat-label>Ministerio</mat-label>
        <mat-select
          [value]="filtros().ministerioId"
          (valueChange)="cambio.emit({ ministerioId: $event })"
        >
          <mat-option value="">{{
            verTodos() ? 'Todos los ministerios' : 'Mis ministerios'
          }}</mat-option>
          @for (m of opcionesMinisterio(); track m.id) {
            <mat-option [value]="m.id">{{ m.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <div class="exportar">
        <app-boton-exportar tipo="asistencia" [filtros]="filtrosExportar()" />
      </div>
    </div>

    <section class="tarjeta">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (sinDatos()) {
        <app-estado-vacio
          [icono]="iconos.BarChart3"
          titulo="No hay asistencia registrada en este periodo"
        />
      } @else {
        <div class="tarjeta-cuerpo contenido">
          <figure aria-labelledby="titulo-grafica" class="figura">
            <figcaption id="titulo-grafica" class="titulo-grafica">
              Presentes y ausentes por {{ periodo() === 'semanal' ? 'semana' : 'mes' }}
            </figcaption>
            <!-- La gráfica es decorativa para lectores de pantalla: la tabla tiene los mismos datos -->
            <div class="grafica" aria-hidden="true">
              <ul class="leyenda">
                <li><span class="muestra presentes"></span> Presentes</li>
                <li><span class="muestra ausentes"></span> Ausentes</li>
              </ul>
              <div class="pares">
                @for (f of datos(); track f.periodo) {
                  <div
                    class="par"
                    [title]="
                      f.etiqueta + ': ' + f.presentes + ' presentes, ' + f.ausentes + ' ausentes'
                    "
                  >
                    <div class="barras">
                      <span
                        class="barra presentes"
                        [style.height.%]="porcentaje(f.presentes)"
                      ></span>
                      <span class="barra ausentes" [style.height.%]="porcentaje(f.ausentes)"></span>
                    </div>
                    <span class="etiqueta">{{ f.etiqueta }}</span>
                  </div>
                }
              </div>
            </div>
          </figure>
          <div class="contenedor-tabla">
            <table class="tabla-simple" aria-label="Resumen de asistencia">
              <thead>
                <tr>
                  <th scope="col">Periodo</th>
                  <th scope="col" class="num">Eventos</th>
                  <th scope="col" class="num">Presentes</th>
                  <th scope="col" class="num">Ausentes</th>
                  <th scope="col" class="num">Promedio por evento</th>
                </tr>
              </thead>
              <tbody>
                @for (f of datos(); track f.periodo) {
                  <tr>
                    <td>{{ f.etiqueta }}</td>
                    <td class="num">{{ f.eventos }}</td>
                    <td class="num">{{ f.presentes }}</td>
                    <td class="num">{{ f.ausentes }}</td>
                    <td class="num">{{ f.promedioPorEvento }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
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
    .contenido {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .figura {
      margin: 0;
    }
    .titulo-grafica {
      margin-bottom: 8px;
      font-weight: 500;
    }
    .leyenda {
      display: flex;
      gap: 16px;
      margin: 0 0 8px;
      padding: 0;
      list-style: none;
      font-size: 13px;
    }
    .leyenda li {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .muestra {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
    .presentes {
      background: var(--exito);
    }
    .ausentes {
      background: var(--peligro);
    }
    .pares {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 28px;
    }
    .par {
      position: relative;
      display: flex;
      min-width: 36px;
      flex: 1;
      flex-direction: column;
    }
    .barras {
      display: flex;
      height: 12rem;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      border-bottom: 1px solid var(--borde);
    }
    .barra {
      display: block;
      width: 40%;
      max-width: 24px;
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
      color: var(--texto-suave);
    }
  `,
})
export class ResumenAsistencia {
  readonly filtros = input.required<FiltrosResumen>();
  readonly cambio = output<Partial<FiltrosResumen>>();

  private readonly servicio = inject(AsistenciaService);
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosMinisterioService);
  private readonly ministeriosService = inject(MinisteriosService);

  protected readonly periodo = computed<PeriodoResumen>(() =>
    this.filtros().periodo === 'mensual' ? 'mensual' : 'semanal',
  );
  protected readonly consulta = rxResource({
    params: () => {
      const f = this.filtros();
      return {
        periodo: this.periodo(),
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
        ministerioId: f.ministerioId || undefined,
      };
    },
    stream: ({ params }) => this.servicio.resumen(params),
  });
  private readonly ministerios = rxResource({
    stream: () => this.ministeriosService.listar({ limit: 100 }),
  });

  protected readonly verTodos = computed(() => this.sesion.puede('asistencia:leer'));
  protected readonly opcionesMinisterio = computed(() =>
    (valorDe(this.ministerios)?.data ?? []).filter(
      (m) => this.verTodos() || this.permisos.coordinados().includes(m.id),
    ),
  );
  protected readonly datos = computed(() =>
    (valorDe(this.consulta) ?? []).map((f) => ({ ...f, etiqueta: etiquetaPeriodo(f.periodo) })),
  );
  protected readonly sinDatos = computed(() => this.datos().every((f) => f.eventos === 0));
  private readonly maximo = computed(() =>
    Math.max(1, ...this.datos().flatMap((f) => [f.presentes, f.ausentes])),
  );
  protected readonly filtrosExportar = computed(() => {
    const f = this.filtros();
    return {
      periodo: this.periodo(),
      desde: f.desde || undefined,
      hasta: f.hasta || undefined,
      ministerioId: f.ministerioId || undefined,
    };
  });
  protected readonly iconos = { BarChart3 };

  protected porcentaje(valor: number) {
    return (valor / this.maximo()) * 100;
  }

  protected fecha(campo: 'desde' | 'hasta', evento: Event) {
    this.cambio.emit({ [campo]: (evento.target as HTMLInputElement).value });
  }
}
