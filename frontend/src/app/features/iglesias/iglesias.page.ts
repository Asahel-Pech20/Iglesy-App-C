import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Church, LucideAngularModule, Plus } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_IGLESIA } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { IglesiaFormDialogo } from './iglesia-form.dialogo';
import { IglesiasService } from './iglesias.service';

/** /iglesias — iglesias del sistema nacional (solo la Coordinación). */
@Component({
  selector: 'app-iglesias',
  imports: [
    MatButton,
    LucideAngularModule,
    PuedeDirective,
    PageHeader,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Iglesias"
      descripcion="Iglesias del sistema. Cada una tiene su propio personal y su propio diezmo."
    >
      <button *appPuede="'iglesias:crear'" matButton="filled" type="button" (click)="nueva()">
        <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Nueva iglesia
      </button>
    </app-page-header>

    <section class="tarjeta">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="3" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos().length === 0) {
        <app-estado-vacio
          [icono]="iconos.Church"
          titulo="Aún no hay iglesias"
          descripcion="Crea la primera para poder asignarle personal."
        >
          <button *appPuede="'iglesias:crear'" matButton="filled" type="button" (click)="nueva()">
            Nueva iglesia
          </button>
        </app-estado-vacio>
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Iglesias">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Zona horaria</th>
              </tr>
            </thead>
            <tbody>
              @for (i of datos(); track i.id) {
                <tr>
                  <td>{{ i.nombre }}</td>
                  <td>{{ tipos[i.tipo] }}</td>
                  <td>{{ i.zonaHoraria }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-paginacion
          [meta]="consulta.value()!.meta"
          (cambio)="filtros.cambiar({ page: $event })"
        />
      }
    </section>
  `,
})
export class IglesiasPage {
  private readonly servicio = inject(IglesiasService);
  private readonly dialogo = inject(MatDialog);

  protected readonly filtros = filtrosURL({ page: 1 });
  protected readonly iconos = { Church, Plus };
  protected readonly tipos = ETIQUETAS_TIPO_IGLESIA;

  protected readonly consulta = rxResource({
    params: () => ({ page: this.filtros.valores().page, limit: 20, v: this.servicio.version() }),
    stream: ({ params: { v: _v, ...query } }) => this.servicio.listar(query),
  });
  protected readonly datos = computed(() => valorDe(this.consulta)?.data ?? []);

  protected nueva() {
    this.dialogo.open(IglesiaFormDialogo, { width: '28rem', maxWidth: 'calc(100vw - 32px)' });
  }
}
