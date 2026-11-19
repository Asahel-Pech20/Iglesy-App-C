import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { formatearFecha } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, mensajeError } from '@/app/core/validadores';
import type { MisaCelebrada } from '@/app/tipos/diezmo';
import { DiezmoService, FORMATO_MONTO } from './diezmo.service';

// Mismas reglas que el backend (dominio/dinero.ts): hasta 10 enteros y 2 decimales, sin signo.
// El monto 0 es válido (misa sin diezmo, supuesto P-23).
const validarMonto: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  if (v === '') return { mensaje: 'Escribe el monto.' };
  if (!FORMATO_MONTO.test(v)) return { mensaje: 'Monto no válido (sin signo, hasta 2 decimales).' };
  return null;
};

/** Captura el diezmo de una misa o corrige el ya capturado. Recibe la misa. */
@Component({
  selector: 'app-monto-diezmo-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ corrige ? 'Corregir diezmo' : 'Capturar diezmo' }}</h2>
    <mat-dialog-content>
      <p class="texto-suave">
        Misa del {{ fecha(misa.fechaLocal) }} a las {{ misa.horaLocal }} · {{ misa.padre.nombre }}.
        @if (corrige) {
          La corrección no borra el monto anterior: queda en el historial.
        }
      </p>
      <form id="form-diezmo" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Monto</mat-label>
          <input
            matInput
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            formControlName="monto"
            required
          />
          <mat-hint>Hasta dos decimales. Escribe 0 si la misa no tuvo diezmo.</mat-hint>
          <mat-error>{{ error() }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-diezmo" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : corrige ? 'Corregir' : 'Capturar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .completo {
      width: 100%;
    }
  `,
})
export class MontoDiezmoDialogo {
  protected readonly misa = inject<MisaCelebrada>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<MontoDiezmoDialogo, boolean>);
  private readonly servicio = inject(DiezmoService);
  private readonly notificar = inject(NotificarService);

  protected readonly corrige = this.misa.diezmo !== null;
  protected readonly fecha = formatearFecha;
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    monto: [this.misa.diezmo?.monto ?? '', validarMonto],
  });

  protected error() {
    return mensajeError(this.form.controls.monto);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const monto = this.form.controls.monto.value.trim();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.corrige
      ? this.servicio.corregir(this.misa.id, monto)
      : this.servicio.capturar(this.misa.id, monto);
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito(this.corrige ? 'Diezmo corregido' : 'Diezmo capturado');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const mensaje = errorDeCampo(e, 'monto');
        if (mensaje) errorServidor(this.form.controls.monto, mensaje);
        else this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
