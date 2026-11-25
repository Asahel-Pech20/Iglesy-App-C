import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, UserRound } from 'lucide-angular';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { Padre } from '@/app/tipos/diezmo';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';
import { PadreDialogo } from './padre.dialogo';

/** Padres que celebran en la iglesia (RF-40, RF-41), con acceso a su agenda semanal (RF-47). */
@Component({
  selector: 'app-padres-tab',
  imports: [
    MatButton,
    RouterLink,
    LucideAngularModule,
    PuedeDirective,
    EstadoError,
    EstadoVacio,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta">
      <div class="encabezado">
        <p class="texto-suave">
          Un padre puede celebrar en varias iglesias: el párroco y sus vicarios atienden también las
          capillas. Quitarlo de tu iglesia no borra su historial.
        </p>
        <button *appPuede="'misas:programar'" matButton="filled" type="button" (click)="agregar()">
          Agregar padre
        </button>
      </div>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="3" [columnas]="2" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (padres().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="Aún no hay padres en tu iglesia"
          descripcion="Agrega a los padres que celebran aquí para asignarles misas."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Padres de la iglesia">
            <thead>
              <tr>
                <th scope="col">Padre</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (p of padres(); track p.id) {
                <tr>
                  <td class="fuerte">{{ nombre(p) }}</td>
                  <td class="acciones">
                    <a matButton [routerLink]="['/padres', p.id, 'agenda']">Ver agenda</a>
                    <button
                      *appPuede="'misas:programar'"
                      matButton
                      type="button"
                      class="peligro"
                      [attr.aria-label]="'Quitar a ' + nombre(p) + ' de la iglesia'"
                      (click)="quitar(p)"
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
export class PadresTab {
  private readonly servicio = inject(MisasService);
  private readonly dialogo = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);

  protected readonly nombre = nombrePadre;
  protected readonly iconoVacio = UserRound;

  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarPadres(),
  });
  protected readonly padres = computed(() => valorDe(this.consulta) ?? []);

  protected agregar() {
    this.dialogo.open(PadreDialogo, { width: '32rem', maxWidth: 'calc(100vw - 32px)' });
  }

  protected quitar(p: Padre) {
    void this.confirmar.abrir({
      titulo: 'Quitar padre de la iglesia',
      descripcion: `${nombrePadre(p)} deja de aparecer en tu iglesia. Si tiene misas en el horario, primero asígnalas a otro padre.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.quitarPadre(p.id),
    });
  }
}
