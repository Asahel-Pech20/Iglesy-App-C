import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Church, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { formatearFecha, formatearFechaHora } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { CelebradaDialogo } from './celebrada.dialogo';
import { MisasService } from './misas.service';

/**
 * Misas celebradas del mes: quién la dio realmente y, si hubo sustitución, el padre programado,
 * quién hizo el cambio, cuándo y por qué (RF-48–RF-51, RN-29, RN-30).
 */
@Component({
  selector: 'app-celebradas-tab',
  imports: [MatButton, LucideAngularModule, PuedeDirective, EstadoError, EstadoVacio, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta">
      <div class="encabezado">
        <p class="texto-suave">
          Misas de este mes. El horario dice lo que normalmente pasa; cada misa celebrada registra
          el día, la hora y el padre que realmente la dio.
        </p>
        <button
          *appPuede="'misas:registrar'"
          matButton="filled"
          type="button"
          (click)="registrar()"
        >
          Registrar misa
        </button>
      </div>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="4" [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (misas().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="No hay misas celebradas este mes"
          descripcion="Registra cada misa a partir del horario; si la dio otro padre, indica el motivo."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Misas celebradas del mes">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Hora</th>
                <th scope="col">La dio</th>
                <th scope="col">Sustitución</th>
              </tr>
            </thead>
            <tbody>
              @for (m of misas(); track m.id) {
                <tr>
                  <td>{{ fecha(m.fechaLocal) }}</td>
                  <td class="num">{{ m.horaLocal }}</td>
                  <td class="fuerte">{{ m.padre.nombre }}</td>
                  <td>
                    @if (m.sustitucion; as s) {
                      <span class="sustitucion">
                        En lugar de {{ s.padreProgramado.nombre }}: «{{ s.motivo }}»
                        <span class="texto-suave">
                          Registró {{ s.hechaPor.nombre }}, {{ fechaHora(s.hechaEn) }}
                        </span>
                      </span>
                    } @else {
                      <span class="texto-suave">—</span>
                    }
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
    .sustitucion {
      display: grid;
      gap: 2px;
    }
    .sustitucion .texto-suave {
      font-size: 12px;
    }
  `,
})
export class CelebradasTab {
  private readonly servicio = inject(MisasService);
  private readonly dialogo = inject(MatDialog);

  protected readonly fecha = formatearFecha;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly iconoVacio = Church;

  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarCelebradas({ limit: 100 }),
  });
  protected readonly misas = computed(() => valorDe(this.consulta)?.data ?? []);

  protected registrar() {
    this.dialogo.open(CelebradaDialogo, { width: '32rem', maxWidth: 'calc(100vw - 32px)' });
  }
}
