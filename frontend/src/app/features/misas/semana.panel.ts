import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { DIAS_SEMANA, formatearFecha } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { EstadoMisaSemana } from '@/app/tipos/misas';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

const sumarDias = (fecha: string, dias: number) =>
  new Date(new Date(`${fecha}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

const ETIQUETA_ESTADO: Record<EstadoMisaSemana, string> = {
  REGISTRADA: 'Registrada',
  PENDIENTE: 'Pendiente',
  FUTURA: 'Aún no empieza',
  SIN_MISA: 'Sin misa (día inhábil)',
};

/**
 * RF-84 (deseable, supuesto P-29): la semana de misas armada desde el horario. Las que ya empezaron
 * y faltan se registran de una vez con su padre programado; una sustitución se registra antes con
 * «Registrar misa».
 */
@Component({
  selector: 'app-semana-misas-panel',
  imports: [MatButton, PuedeDirective, EstadoError, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta" aria-labelledby="titulo-semana">
      <div class="encabezado">
        <h2 id="titulo-semana">Semana armada desde el horario</h2>
        @if (datos(); as d) {
          <nav class="navegacion" aria-label="Semana">
            <button matButton="outlined" type="button" (click)="mover(-7)">Anterior</button>
            <span>Del {{ fecha(d.semana.desde) }} al {{ fecha(d.semana.hasta) }}</span>
            <button matButton="outlined" type="button" (click)="mover(7)">Siguiente</button>
          </nav>
        }
      </div>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="3" [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos(); as d) {
        @if (d.misas.length === 0) {
          <p class="texto-suave">El horario no tiene misas.</p>
        } @else {
          <div class="contenedor-tabla">
            <table class="tabla-simple" aria-label="Misas de la semana">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Padre programado</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (m of d.misas; track m.horarioId + m.fecha) {
                  <tr>
                    <td>{{ dias[m.diaSemana] }} {{ fecha(m.fecha) }}</td>
                    <td class="num">
                      {{ m.hora }}
                      @if (m.excepcion?.tipo === 'OTRA_HORA') {
                        <span class="texto-suave"> (antes {{ m.excepcion!.horaHorario }})</span>
                      }
                    </td>
                    <td>{{ padre(m.padreProgramado) }}</td>
                    <td>
                      <span class="estado" [attr.data-estado]="m.estado">{{
                        estados[m.estado]
                      }}</span>
                      @if (m.excepcion) {
                        <span class="texto-suave"> · {{ m.excepcion.motivo }}</span>
                      }
                      @if (m.misaCelebrada?.conSustitucion) {
                        <span class="texto-suave">
                          · la dio {{ m.misaCelebrada!.padre.nombre }}</span
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="acciones" *appPuede="'misas:registrar'">
            <button
              matButton="filled"
              type="button"
              [disabled]="pendientes() === 0 || armando()"
              (click)="armar(d.semana.desde)"
            >
              {{ armando() ? 'Registrando…' : 'Registrar las pendientes (' + pendientes() + ')' }}
            </button>
            <span class="texto-suave">
              Se registran con su padre programado. Si alguna la dio otro padre, regístrala antes
              con «Registrar misa».
            </span>
          </div>
          @if (omitidas().length > 0) {
            <ul class="alerta alerta-peligro" role="alert">
              @for (o of omitidas(); track o.fecha + o.hora) {
                <li>{{ fecha(o.fecha) }} {{ o.hora }}: {{ o.motivo }}</li>
              }
            </ul>
          }
        }
      }
    </section>
  `,
  styles: `
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
    .navegacion {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .estado {
      font-weight: 500;
    }
    .estado[data-estado='PENDIENTE'] {
      color: var(--alerta);
    }
    .estado[data-estado='SIN_MISA'] {
      color: var(--texto-suave);
    }
    .estado[data-estado='REGISTRADA'] {
      color: var(--exito);
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-top: 12px;
    }
    ul.alerta {
      margin: 12px 0 0;
      padding-left: 24px;
    }
  `,
})
export class SemanaMisasPanel {
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly estados = ETIQUETA_ESTADO;
  protected readonly fecha = formatearFecha;
  protected readonly padre = nombrePadre;
  private readonly semanaElegida = signal<string | undefined>(undefined);
  protected readonly armando = signal(false);
  protected readonly omitidas = signal<{ fecha: string; hora: string; motivo: string }[]>([]);

  protected readonly consulta = rxResource({
    params: () => ({ semana: this.semanaElegida(), v: this.servicio.version() }),
    stream: ({ params }) => this.servicio.semana(params.semana),
  });
  protected readonly datos = computed(() => valorDe(this.consulta));
  protected readonly pendientes = computed(
    () => this.datos()?.misas.filter((m) => m.estado === 'PENDIENTE').length ?? 0,
  );

  protected mover(dias: number) {
    const desde = this.datos()?.semana.desde;
    if (!desde) return;
    this.omitidas.set([]);
    this.semanaElegida.set(sumarDias(desde, dias));
  }

  protected armar(semana: string) {
    this.armando.set(true);
    this.servicio.armarSemana(semana).subscribe({
      next: (r) => {
        this.armando.set(false);
        this.omitidas.set(r.omitidas);
        this.notificar.exito(
          r.creadas === 1 ? '1 misa registrada' : `${r.creadas} misas registradas`,
        );
      },
      error: (e: unknown) => {
        this.armando.set(false);
        this.notificar.error(e);
      },
    });
  }
}
