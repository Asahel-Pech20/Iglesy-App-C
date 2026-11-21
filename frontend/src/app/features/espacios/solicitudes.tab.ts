import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { Landmark } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import type { EstadoSolicitud, SolicitudEspacio } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import {
  ESTADOS,
  ETIQUETAS_CLASE,
  ETIQUETAS_ESTADO,
  fechaHoraLocal,
  varianteEstado,
} from './formato-espacios';

/** Solicitudes de la iglesia, con los datos de contacto (privados de la iglesia, RN-53). */
@Component({
  selector: 'app-solicitudes-espacio-tab',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    BadgeEstado,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros" role="search">
      <mat-form-field subscriptSizing="dynamic" class="select-filtro">
        <mat-label>Estado</mat-label>
        <mat-select
          [value]="filtros.valores().estado"
          (valueChange)="filtros.cambiar({ estado: $event })"
        >
          <mat-option value="">Todos</mat-option>
          @for (e of estados; track e) {
            <mat-option [value]="e">{{ etiquetasEstado[e] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    <section class="tarjeta">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="5" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="No hay solicitudes"
          descripcion="Cuando alguien pida un espacio con el enlace público de tu iglesia, aparecerá aquí."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Solicitudes de espacio">
            <thead>
              <tr>
                <th scope="col">Folio</th>
                <th scope="col">Recibida</th>
                <th scope="col">Espacio</th>
                <th scope="col">Contacto</th>
                <th scope="col">Estado</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (s of datos(); track s.id) {
                <tr>
                  <td>{{ s.folio }}</td>
                  <td>{{ hora(s.creadaLocal) }}</td>
                  <td>{{ etiquetasClase[s.tipo.clase] }}</td>
                  <td>{{ s.contacto.nombre }}</td>
                  <td>
                    <app-badge-estado
                      [etiqueta]="etiquetasEstado[s.estado]"
                      [variante]="variante(s.estado)"
                    />
                  </td>
                  <td class="acciones">
                    <button
                      matButton="outlined"
                      type="button"
                      [attr.aria-label]="'Abrir la solicitud ' + s.folio"
                      (click)="abrir.emit(s)"
                    >
                      Abrir
                    </button>
                  </td>
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
export class SolicitudesEspacioTab {
  readonly abrir = output<SolicitudEspacio>();

  private readonly servicio = inject(EspaciosService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly filtros = filtrosURL({ estado: '', page: 1 });
  protected readonly estados = ESTADOS;
  protected readonly etiquetasEstado = ETIQUETAS_ESTADO;
  protected readonly etiquetasClase = ETIQUETAS_CLASE;
  protected readonly variante = varianteEstado;
  protected readonly hora = fechaHoraLocal;
  protected readonly iconoVacio = Landmark;

  protected readonly consulta = rxResource({
    params: () => ({
      estado: (this.filtros.valores().estado || undefined) as EstadoSolicitud | undefined,
      page: this.filtros.valores().page,
      limit: 20,
      version: this.servicio.version(),
    }),
    stream: ({ params: { version: _version, ...query } }) => this.servicio.listarSolicitudes(query),
  });
  protected readonly datos = computed(() => valorDe(this.consulta)?.data ?? []);
}
