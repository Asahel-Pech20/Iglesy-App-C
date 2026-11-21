import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_ESTADO_OBJETO } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError, requerido } from '@/app/core/validadores';
import { fechaNoFutura } from '@/app/features/iglesias/validadores-iglesia';
import type { EstadoObjeto, ObjetoPatrimonial } from '@/app/tipos/patrimonio';
import { PatrimonioService } from './patrimonio.service';

/** Mismas transiciones que el backend (RF-15; regreso de préstamo: supuesto de P-08). */
export const TRANSICIONES: Record<EstadoObjeto, EstadoObjeto[]> = {
  VIGENTE: ['PRESTADO', 'PERDIDO', 'BAJA'],
  PRESTADO: ['VIGENTE', 'BAJA'],
  PERDIDO: ['VIGENTE', 'BAJA'],
  BAJA: [],
};

/**
 * RF-15, RN-11: marca un objeto como perdido, prestado o dado de baja (o su regreso), con fecha y
 * motivo. El objeto no se borra. Recibe `{ iglesiaId, objeto }`; se cierra con `true` si guardó.
 */
@Component({
  selector: 'app-estado-objeto-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Cambiar estado</h2>
    <mat-dialog-content>
      <p>
        <strong>{{ datos.objeto.descripcion }}</strong> está
        {{ etiquetas[datos.objeto.estado].toLowerCase() }}. Solo los vigentes cuentan en el índice;
        el registro se conserva.
      </p>
      <form id="form-estado" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Nuevo estado</mat-label>
          <mat-select formControlName="estado" required>
            @for (e of opciones; track e) {
              <mat-option [value]="e">{{
                e === 'VIGENTE' ? 'Regresó (vigente)' : etiquetas[e]
              }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ error('estado') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Fecha</mat-label>
          <input matInput type="date" formControlName="fecha" required />
          <mat-error>{{ error('fecha') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Motivo</mat-label>
          <textarea matInput rows="3" formControlName="motivo" required></textarea>
          <mat-error>{{ error('motivo') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-estado" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class EstadoObjetoDialogo {
  protected readonly ref = inject(MatDialogRef<EstadoObjetoDialogo, boolean>);
  protected readonly datos = inject<{ iglesiaId: string; objeto: ObjetoPatrimonial }>(
    MAT_DIALOG_DATA,
  );
  private readonly servicio = inject(PatrimonioService);
  private readonly notificar = inject(NotificarService);

  protected readonly etiquetas = ETIQUETAS_ESTADO_OBJETO;
  protected readonly opciones = TRANSICIONES[this.datos.objeto.estado];
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    estado: ['' as EstadoObjeto | '', requerido('Elige el nuevo estado.')],
    fecha: [new Date().toISOString().slice(0, 10), fechaNoFutura],
    motivo: ['', [requerido('Escribe el motivo.'), maximo(500)]],
  });

  protected error(campo: 'estado' | 'fecha' | 'motivo') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .cambiarEstado(this.datos.iglesiaId, this.datos.objeto.id, {
        estado: v.estado as EstadoObjeto,
        fecha: v.fecha,
        motivo: v.motivo.trim(),
      })
      .subscribe({
        next: () => {
          this.notificar.exito('Estado guardado');
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const campos = (['estado', 'fecha', 'motivo'] as const).filter((campo) => {
            const mensaje = errorDeCampo(e, campo);
            if (mensaje) errorServidor(this.form.controls[campo], mensaje);
            return Boolean(mensaje);
          });
          if (campos.length === 0) this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
