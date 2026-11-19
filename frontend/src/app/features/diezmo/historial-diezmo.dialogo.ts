import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { formatearFecha, formatearFechaHora } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import type { MisaCelebrada } from '@/app/tipos/diezmo';
import { DiezmoService } from './diezmo.service';

/** Monto vigente de una misa y la lista de correcciones (quién, cuándo, de cuánto a cuánto). */
@Component({
  selector: 'app-historial-diezmo-dialogo',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, EstadoError, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Historial del diezmo</h2>
    <mat-dialog-content>
      <p class="texto-suave">
        Misa del {{ fecha(misa.fechaLocal) }} a las {{ misa.horaLocal }} · {{ misa.padre.nombre }}
      </p>
      @if (consulta.isLoading()) {
        <app-esqueleto [filas]="3" [columnas]="2" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (diezmo(); as d) {
        <p>
          Monto vigente: <strong>{{ moneda.formato(d.monto) }}</strong>
        </p>
        <p class="texto-suave">
          Capturado por {{ d.capturadoPor.nombre }} el {{ fechaHora(d.createdAt) }}.
        </p>
        @if (d.correcciones.length === 0) {
          <p>Sin correcciones.</p>
        } @else {
          <h3>Correcciones</h3>
          <ol class="correcciones" aria-label="Correcciones del diezmo">
            @for (c of d.correcciones; track c.id) {
              <li>
                {{ moneda.formato(c.montoAnterior) }} →
                <strong>{{ moneda.formato(c.montoNuevo) }}</strong>
                <span class="texto-suave">
                  · {{ c.hechaPor.nombre }}, {{ fechaHora(c.hechaEn) }}</span
                >
              </li>
            }
          </ol>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" (click)="ref.close()">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .correcciones {
      padding-left: 20px;
      display: grid;
      gap: 8px;
    }
  `,
})
export class HistorialDiezmoDialogo {
  protected readonly misa = inject<MisaCelebrada>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<HistorialDiezmoDialogo>);
  private readonly servicio = inject(DiezmoService);
  protected readonly moneda = inject(FormatoMonedaService);
  protected readonly fecha = formatearFecha;
  protected readonly fechaHora = formatearFechaHora;

  protected readonly consulta = rxResource({ stream: () => this.servicio.obtener(this.misa.id) });
  protected readonly diezmo = computed(() => valorDe(this.consulta));
}
