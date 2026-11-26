import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { DIAS_SEMANA, formatearFecha } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { ExcepcionMisa } from '@/app/tipos/misas';
import { ExcepcionMisaDialogo } from './excepcion.dialogo';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

/**
 * E3-25 (supuesto P-33): días en que una misa del horario no se celebra o se celebra a otra hora.
 * Muestra los próximos 60 días; el horario semanal no cambia.
 */
@Component({
  selector: 'app-excepciones-misa-panel',
  imports: [MatButton, PuedeDirective, EstadoError, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta" aria-labelledby="titulo-excepciones">
      <div class="encabezado">
        <div>
          <h2 id="titulo-excepciones">Días sin misa o con otra hora</h2>
          <p class="texto-suave">
            Próximos 60 días. El horario de cada semana no cambia; el público ve estos avisos en la
            ficha de la iglesia.
          </p>
        </div>
        <button *appPuede="'misas:programar'" matButton="filled" type="button" (click)="marcar()">
          Marcar día
        </button>
      </div>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="2" [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (excepciones().length === 0) {
        <p class="texto-suave">No hay días sin misa ni cambios de hora en los próximos 60 días.</p>
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Días sin misa o con otra hora">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Misa</th>
                <th scope="col">Cambio</th>
                <th scope="col">Motivo</th>
                <th scope="col" *appPuede="'misas:programar'">
                  <span class="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (e of excepciones(); track e.id) {
                <tr>
                  <td>{{ dias[e.misa.diaSemana] }} {{ fecha(e.fecha) }}</td>
                  <td>{{ e.misa.hora }} · {{ padre(e.misa.padre) }}</td>
                  <td class="fuerte">
                    {{ e.tipo === 'SIN_MISA' ? 'Sin misa' : 'A las ' + e.horaNueva }}
                  </td>
                  <td>{{ e.motivo }}</td>
                  <td *appPuede="'misas:programar'" class="acciones">
                    <button
                      matButton
                      type="button"
                      class="peligro"
                      [attr.aria-label]="
                        'Quitar el cambio del ' + fecha(e.fecha) + ' ' + e.misa.hora
                      "
                      (click)="quitar(e)"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 500;
    }
    .encabezado p {
      margin: 0;
    }
    .encabezado > div {
      flex: 1 1 20rem;
    }
    .acciones {
      white-space: nowrap;
      text-align: right;
    }
    .peligro {
      color: var(--peligro);
    }
  `,
})
export class ExcepcionesMisaPanel {
  private readonly servicio = inject(MisasService);
  private readonly dialogo = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly fecha = formatearFecha;
  protected readonly padre = nombrePadre;

  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.excepciones(),
  });
  protected readonly excepciones = computed(() => valorDe(this.consulta)?.excepciones ?? []);

  protected marcar() {
    this.dialogo.open(ExcepcionMisaDialogo, { width: '32rem', maxWidth: 'calc(100vw - 32px)' });
  }

  protected quitar(e: ExcepcionMisa) {
    void this.confirmar.abrir({
      titulo: 'Quitar el cambio',
      descripcion: `La misa del ${formatearFecha(e.fecha)} a las ${e.misa.hora} vuelve a su horario normal.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.quitarExcepcion(e.id),
    });
  }
}
