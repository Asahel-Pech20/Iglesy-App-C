import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_TIPO_IGLESIA, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError, requerido } from '@/app/core/validadores';
import type { TipoIglesia } from '@/app/tipos/iglesias';
import { IglesiasService } from './iglesias.service';

const CAMPOS = ['nombre', 'tipo', 'zonaHoraria'] as const;

/** Crea una iglesia (solo la Coordinación). Se cierra con `true` si guardó. */
@Component({
  selector: 'app-iglesia-form-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Nueva iglesia</h2>
    <mat-dialog-content>
      <form id="form-iglesia" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput autocomplete="off" formControlName="nombre" required />
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo" required>
            @for (o of tipos; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ error('tipo') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Zona horaria</mat-label>
          <input matInput autocomplete="off" formControlName="zonaHoraria" required />
          <mat-hint>Define la hora local de las misas, p. ej. America/Mexico_City.</mat-hint>
          <mat-error>{{ error('zonaHoraria') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-iglesia" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class IglesiaFormDialogo {
  protected readonly ref = inject(MatDialogRef<IglesiaFormDialogo, boolean>);
  private readonly servicio = inject(IglesiasService);
  private readonly notificar = inject(NotificarService);

  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_IGLESIA);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [requerido('Escribe el nombre.'), maximo(150)]],
    tipo: ['' as TipoIglesia | '', requerido('Elige el tipo de iglesia.')],
    zonaHoraria: ['America/Mexico_City', requerido('Escribe la zona horaria.')],
  });

  protected error(campo: (typeof CAMPOS)[number]) {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .crear({
        nombre: v.nombre.trim(),
        tipo: v.tipo as TipoIglesia,
        zonaHoraria: v.zonaHoraria.trim(),
      })
      .subscribe({
        next: () => {
          this.notificar.exito('Iglesia creada');
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const conCampo = CAMPOS.filter((campo) => {
            const mensaje = errorDeCampo(e, campo);
            if (mensaje) errorServidor(this.form.controls[campo], mensaje);
            return Boolean(mensaje);
          });
          if (conCampo.length === 0) this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
