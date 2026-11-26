import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { CalendarClock, LucideAngularModule } from 'lucide-angular';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { DIAS_SEMANA } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { HorarioMisa } from '@/app/tipos/misas';
import {
  describirDuracion,
  ETIQUETAS_IDIOMA,
  ETIQUETAS_TIPO_MISA,
  nombrePadre,
} from './formato-misas';
import { HorarioMisaDialogo } from './horario.dialogo';
import { MisasService } from './misas.service';

/** Horario semanal de misas con el padre de cada una (RF-42–RF-46). */
@Component({
  selector: 'app-horario-misas-tab',
  imports: [MatButton, LucideAngularModule, PuedeDirective, EstadoError, EstadoVacio, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta">
      <div class="encabezado">
        <p class="texto-suave">
          Lo que normalmente pasa cada semana, en la hora local de la iglesia. Un padre no puede
          tener dos misas que se empalmen, aunque sean en templos distintos.
        </p>
        <button
          *appPuede="'misas:programar'"
          matButton="filled"
          type="button"
          (click)="programar()"
        >
          Programar misa
        </button>
      </div>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="4" [columnas]="5" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (misas().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="Aún no hay misas en el horario"
          descripcion="Programa las misas de la semana con su día, hora, tipo, idioma y padre."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Horario semanal de misas">
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Hora</th>
                <th scope="col">Tipo</th>
                <th scope="col">Idioma</th>
                <th scope="col">Duración</th>
                <th scope="col">Padre</th>
                <th scope="col" *appPuede="'misas:programar'">
                  <span class="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (m of misas(); track m.id) {
                <tr>
                  <td>{{ dias[m.diaSemana] }}</td>
                  <td class="num">{{ m.hora }}</td>
                  <td>{{ tipos[m.tipo] }}</td>
                  <td>{{ idiomas[m.idioma] }}</td>
                  <td>{{ duracion(m.duracionMin) }}</td>
                  <td class="fuerte">{{ padre(m.padre) }}</td>
                  <td *appPuede="'misas:programar'" class="acciones">
                    <button
                      matButton
                      type="button"
                      [attr.aria-label]="'Cambiar la misa del ' + dias[m.diaSemana] + ' ' + m.hora"
                      (click)="cambiar(m)"
                    >
                      Cambiar
                    </button>
                    <button
                      matButton
                      type="button"
                      class="peligro"
                      [attr.aria-label]="'Quitar la misa del ' + dias[m.diaSemana] + ' ' + m.hora"
                      (click)="quitar(m)"
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
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .encabezado p {
      margin: 0;
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
export class HorarioMisasTab {
  private readonly servicio = inject(MisasService);
  private readonly dialogo = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly tipos = ETIQUETAS_TIPO_MISA;
  protected readonly idiomas = ETIQUETAS_IDIOMA;
  protected readonly padre = nombrePadre;
  protected readonly duracion = (m: number | null) => describirDuracion(m);
  protected readonly iconoVacio = CalendarClock;

  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarHorario(),
  });
  protected readonly misas = computed(() => valorDe(this.consulta) ?? []);

  private abrir(misa: HorarioMisa | null) {
    this.dialogo.open(HorarioMisaDialogo, {
      data: misa,
      width: '32rem',
      maxWidth: 'calc(100vw - 32px)',
    });
  }

  protected programar() {
    this.abrir(null);
  }

  protected cambiar(misa: HorarioMisa) {
    this.abrir(misa);
  }

  protected quitar(misa: HorarioMisa) {
    void this.confirmar.abrir({
      titulo: 'Quitar misa del horario',
      descripcion: `La misa del ${DIAS_SEMANA[misa.diaSemana]} a las ${misa.hora} deja de programarse. Las misas ya celebradas se conservan.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.quitarMisa(misa.id),
    });
  }
}
