import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
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
import { format } from 'date-fns';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, mensajeError, requerido } from '@/app/core/validadores';
import { DiezmoService } from './diezmo.service';

const ahoraLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

const noFutura: ValidatorFn = (c) =>
  c.value && String(c.value) > ahoraLocal()
    ? { mensaje: 'Solo se registra una misa que ya se celebró.' }
    : null;

/** Registra una misa ya celebrada (fecha y hora + padre que ofició) para poder capturar su diezmo. */
@Component({
  selector: 'app-registrar-misa-dialogo',
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
    MatSelect,
    MatOption,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registrar misa celebrada</h2>
    <mat-dialog-content>
      <form id="form-misa" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Fecha y hora</mat-label>
          <input matInput type="datetime-local" formControlName="inicio" required />
          <mat-error>{{ error('inicio') }}</mat-error>
        </mat-form-field>
        <mat-form-field class="completo">
          <mat-label>Padre que ofició</mat-label>
          <mat-select formControlName="padreId" required>
            @for (p of padres(); track p.id) {
              <mat-option [value]="p.id">{{ p.nombre }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ error('padreId') }}</mat-error>
        </mat-form-field>
      </form>
      <div class="nuevo-padre">
        <mat-form-field subscriptSizing="dynamic" class="nuevo">
          <mat-label>¿No está? Agrega un padre</mat-label>
          <input
            matInput
            autocomplete="off"
            maxlength="120"
            [value]="nuevoPadre()"
            #np
            (input)="nuevoPadre.set(np.value)"
          />
          <mat-hint>Escribe el nombre y pulsa «Agregar».</mat-hint>
        </mat-form-field>
        <button
          matButton="tonal"
          type="button"
          [disabled]="agregando() || !nuevoPadre().trim()"
          (click)="agregarPadre()"
        >
          Agregar
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-misa" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .completo {
      width: 100%;
    }
    .nuevo-padre {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .nuevo {
      flex: 1;
    }
  `,
})
export class RegistrarMisaDialogo {
  protected readonly ref = inject(MatDialogRef<RegistrarMisaDialogo, boolean>);
  private readonly servicio = inject(DiezmoService);
  private readonly notificar = inject(NotificarService);

  protected readonly listaPadres = rxResource({ stream: () => this.servicio.listarPadres() });
  protected readonly padres = () => (this.listaPadres.hasValue() ? this.listaPadres.value() : []);
  protected readonly nuevoPadre = signal('');
  protected readonly agregando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    inicio: ['', [requerido('Indica la fecha y la hora.'), noFutura]],
    padreId: ['', requerido('Elige el padre que ofició.')],
  });

  protected error(campo: 'inicio' | 'padreId') {
    return mensajeError(this.form.controls[campo]);
  }

  protected agregarPadre() {
    const nombre = this.nuevoPadre().trim();
    if (!nombre) return;
    this.agregando.set(true);
    this.servicio.crearPadre(nombre).subscribe({
      next: (padre) => {
        this.agregando.set(false);
        this.nuevoPadre.set('');
        this.listaPadres.reload();
        this.form.controls.padreId.setValue(padre.id);
      },
      error: (e: unknown) => {
        this.agregando.set(false);
        this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarMisa({ inicio: new Date(v.inicio).toISOString(), padreId: v.padreId })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.notificar.exito('Misa registrada');
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const mensaje = errorDeCampo(e, 'inicio');
          if (mensaje) errorServidor(this.form.controls.inicio, mensaje);
          else this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
