import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { Landmark } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { NotificarService } from '@/app/core/notificar.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import type { ClaseEspacio, TipoEspacio } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import { CLASES, ETIQUETAS_CLASE } from './formato-espacios';

/** Tipos de espacio que ofrece la iglesia: se agregan, se marcan sin lugar y se desactivan (no se borran). */
@Component({
  selector: 'app-tipos-espacio-tab',
  imports: [
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatSlideToggle,
    PuedeDirective,
    EstadoError,
    EstadoVacio,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta">
      <p class="texto-suave intro">
        Lo que ofreces al público. Los precios no se publican: cada caso se cotiza aparte. Un tipo
        «sin lugar» no aparece en la página pública; uno desactivado tampoco, pero conserva sus
        solicitudes.
      </p>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="3" [columnas]="3" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (tipos().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="Aún no ofreces ningún tipo de espacio"
          descripcion="Agrega cripta, nicho, columbario u osario para recibir solicitudes."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Tipos de espacio">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Se ofrece</th>
                <th scope="col">Hay lugar</th>
              </tr>
            </thead>
            <tbody>
              @for (t of tipos(); track t.id) {
                <tr>
                  <td>{{ etiquetas[t.clase] }}</td>
                  <td>
                    <mat-slide-toggle
                      [checked]="t.activo"
                      [disabled]="!puedeGestionar()"
                      [attr.aria-label]="'Se ofrece: ' + etiquetas[t.clase]"
                      (change)="cambiar(t, { activo: $event.checked })"
                    />
                  </td>
                  <td>
                    <mat-slide-toggle
                      [checked]="t.disponible"
                      [disabled]="!puedeGestionar() || !t.activo"
                      [attr.aria-label]="'Hay lugar: ' + etiquetas[t.clase]"
                      (change)="cambiar(t, { disponible: $event.checked })"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (faltantes().length > 0) {
        <div *appPuede="'espacios:gestionar'" class="agregar">
          <mat-form-field subscriptSizing="dynamic" class="select-filtro">
            <mat-label>Agregar tipo</mat-label>
            <mat-select (valueChange)="agregar($event)" [value]="null">
              @for (c of faltantes(); track c) {
                <mat-option [value]="c">{{ etiquetas[c] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }
    </section>
  `,
  styles: `
    .intro {
      margin: 0 0 12px;
    }
    .agregar {
      margin-top: 16px;
    }
  `,
})
export class TiposEspacioTab {
  private readonly servicio = inject(EspaciosService);
  private readonly notificar = inject(NotificarService);
  private readonly sesion = inject(SesionService);

  protected readonly etiquetas = ETIQUETAS_CLASE;
  protected readonly iconoVacio = Landmark;
  protected readonly puedeGestionar = computed(() => this.sesion.puede('espacios:gestionar'));

  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarTipos(),
  });
  protected readonly tipos = computed(() => valorDe(this.consulta) ?? []);
  protected readonly faltantes = computed(() =>
    CLASES.filter((c) => !this.tipos().some((t) => t.clase === c)),
  );

  protected agregar(clase: ClaseEspacio | null) {
    if (!clase) return;
    this.servicio.crearTipo(clase).subscribe({
      next: () => this.notificar.exito(`${ETIQUETAS_CLASE[clase]} agregado`),
      error: (e: unknown) => this.notificar.error(e),
    });
  }

  protected cambiar(tipo: TipoEspacio, cambios: { activo?: boolean; disponible?: boolean }) {
    this.servicio.editarTipo(tipo.id, cambios).subscribe({
      next: () => this.notificar.exito('Cambio guardado'),
      error: (e: unknown) => {
        this.notificar.error(e);
        this.consulta.reload();
      },
    });
  }
}
