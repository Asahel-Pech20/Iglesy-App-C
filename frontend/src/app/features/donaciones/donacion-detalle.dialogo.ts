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
import { RouterLink } from '@angular/router';
import { Ban, LucideAngularModule, Pencil } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { ETIQUETAS_METODO, formatearFecha, formatearFechaHora } from '@/app/core/formato';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { Donacion } from '@/app/tipos/donaciones';
import { DonacionesService } from './donaciones.service';
import { conceptoDe, nombreDonante } from './formato-donacion';

/** Qué quiere hacer el usuario al cerrar el detalle */
export type AccionDetalle =
  { accion: 'editar'; donacion: Donacion } | { accion: 'anular'; donacion: Donacion };

/** Detalle de una aportación con su auditoría; Editar y Anular solo si no está anulada (F4-03). Recibe el id. */
@Component({
  selector: 'app-donacion-detalle-dialogo',
  imports: [
    RouterLink,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    LucideAngularModule,
    PuedeDirective,
    BadgeEstado,
    EstadoError,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Detalle de la aportación</h2>
    <mat-dialog-content>
      <p class="texto-suave">Datos y auditoría del registro.</p>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="2" />
      } @else if (consulta.error() || !d()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else {
        @let x = d()!;
        <div class="monto-fila">
          <p class="monto" [class.tachado]="x.anulada">{{ moneda.formato(x.monto) }}</p>
          @if (x.anulada) {
            <app-badge-estado etiqueta="Anulada" variante="peligro" />
          }
        </div>
        <dl class="lista-datos">
          <dt>Fecha</dt>
          <dd>{{ fecha(x.fecha) }}</dd>
          <dt>Donante</dt>
          <dd>
            @if (x.miembro) {
              <a [routerLink]="['/miembros', x.miembro.id]" (click)="ref.close()">{{
                donante(x)
              }}</a>
            } @else {
              Anónimo
            }
          </dd>
          <dt>Concepto</dt>
          <dd>{{ concepto(x) }}</dd>
          <dt>Método</dt>
          <dd>{{ metodos[x.metodo] }}</dd>
          <dt>Referencia</dt>
          <dd>{{ x.referencia ?? '—' }}</dd>
          <dt>Notas</dt>
          <dd>{{ x.notas ?? '—' }}</dd>
        </dl>

        <section aria-labelledby="auditoria" class="auditoria">
          <h3 id="auditoria">Auditoría</h3>
          <dl class="lista-datos">
            <dt>Registrada por</dt>
            <dd>{{ x.registradoPor.nombre }} · {{ fechaHora(x.createdAt) }}</dd>
            @if (x.actualizadoPor && !x.anulada) {
              <dt>Editada por</dt>
              <dd>{{ x.actualizadoPor.nombre }} · {{ fechaHora(x.updatedAt) }}</dd>
            }
            @if (x.anulada) {
              <dt>Anulada por</dt>
              <dd>{{ x.actualizadoPor?.nombre ?? '—' }} · {{ fechaHora(x.anuladaEn) }}</dd>
              <dt>Motivo</dt>
              <dd>{{ x.motivoAnulacion ?? '—' }}</dd>
            }
          </dl>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close()">Cerrar</button>
      @if (d(); as x) {
        @if (!x.anulada) {
          <button
            *appPuede="'donaciones:eliminar'"
            matButton="outlined"
            type="button"
            (click)="ref.close({ accion: 'anular', donacion: x })"
          >
            <lucide-icon [img]="iconos.Ban" [size]="16" aria-hidden="true" /> Anular
          </button>
          <button
            *appPuede="'donaciones:editar'"
            matButton="filled"
            type="button"
            (click)="ref.close({ accion: 'editar', donacion: x })"
          >
            <lucide-icon [img]="iconos.Pencil" [size]="16" aria-hidden="true" /> Editar
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: `
    .monto-fila {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .monto {
      margin: 0;
      font-size: 24px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    .tachado {
      text-decoration: line-through;
    }
    .auditoria {
      margin-top: 16px;
      padding: 12px;
      border: 1px solid var(--marco);
      border-radius: 4px;
    }
    .auditoria h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    .lista-datos {
      font-size: 14px;
      gap: 6px 16px;
    }
  `,
})
export class DonacionDetalleDialogo {
  private readonly id = inject<string>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<DonacionDetalleDialogo, AccionDetalle | undefined>);
  private readonly servicio = inject(DonacionesService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly consulta = rxResource({ stream: () => this.servicio.obtener(this.id) });
  protected readonly d = computed(() => valorDe(this.consulta));

  protected readonly iconos = { Ban, Pencil };
  protected readonly metodos = ETIQUETAS_METODO;
  protected readonly fecha = formatearFecha;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly donante = nombreDonante;
  protected readonly concepto = conceptoDe;
}
