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
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { aFechaApi } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError } from '@/app/core/validadores';
import type { Iglesia } from '@/app/tipos/iglesias';
import { IglesiasService } from './iglesias.service';
import { fechaNoFutura } from './validadores-iglesia';

/**
 * RF-11, RN-07: cierra una iglesia con fecha y motivo. No borra nada: deja de aparecer en las
 * consultas públicas, la búsqueda y el ranking. Recibe la iglesia; se cierra con `true` si guardó.
 */
@Component({
  selector: 'app-cerrar-iglesia-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Cerrar iglesia</h2>
    <mat-dialog-content>
      <p>
        <strong>{{ iglesia.nombre }}</strong> conservará sus datos y objetos, pero dejará de
        aparecer en las consultas públicas y en el ranking.
      </p>
      <form id="form-cierre" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Fecha de cierre</mat-label>
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
      <button matButton="filled" type="submit" form="form-cierre" [disabled]="enviando()">
        {{ enviando() ? 'Cerrando…' : 'Cerrar iglesia' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class CerrarIglesiaDialogo {
  protected readonly ref = inject(MatDialogRef<CerrarIglesiaDialogo, boolean>);
  protected readonly iglesia = inject<Iglesia>(MAT_DIALOG_DATA);
  private readonly servicio = inject(IglesiasService);
  private readonly notificar = inject(NotificarService);

  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    fecha: [aFechaApi(new Date()), fechaNoFutura],
    motivo: [
      '',
      [
        (c: { value: unknown }) =>
          String(c.value ?? '').trim().length < 3
            ? { mensaje: 'Escribe el motivo del cierre.' }
            : null,
        maximo(500),
      ],
    ],
  });

  protected error(campo: 'fecha' | 'motivo') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio.cerrar(this.iglesia.id, { fecha: v.fecha, motivo: v.motivo.trim() }).subscribe({
      next: () => {
        this.notificar.exito('Iglesia cerrada');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const campos = (['fecha', 'motivo'] as const).filter((campo) => {
          const mensaje = errorDeCampo(e, campo);
          if (mensaje) errorServidor(this.form.controls[campo], mensaje);
          return Boolean(mensaje);
        });
        if (campos.length === 0) this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
