import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, mensajeError, requerido, textoONull } from '@/app/core/validadores';
import { ETIQUETAS_FORMA_COSTO } from '@/app/features/misas/formato-misas';
import type { FormaCosto, Servicio } from '@/app/tipos/servicios';
import { crearFormHorario, HorariosEditor, sinRepetidos } from './horarios-editor';
import { FORMATO_DINERO, ServiciosService } from './servicios.service';

/**
 * Registra o modifica un servicio (RF-30–RF-34): nombre libre (supuesto P-10), costo con monto,
 * gratuito o donativo con monto sugerido opcional (RN-22, P-11), requisitos, duración, cita y
 * días y horarios.
 */
@Component({
  selector: 'app-servicio-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    HorariosEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ servicio ? 'Modificar servicio' : 'Nuevo servicio' }}</h2>
    <mat-dialog-content>
      <form id="form-servicio" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="80" required />
          <mat-hint>Bautizo, primera comunión, confirmación, casamiento, XV años…</mat-hint>
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        <div class="fila">
          <mat-form-field>
            <mat-label>Costo</mat-label>
            <mat-select formControlName="formaCosto" required>
              @for (f of formas; track f.valor) {
                <mat-option [value]="f.valor">{{ f.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (forma() !== 'GRATUITO') {
            <mat-form-field>
              <mat-label>{{
                forma() === 'DONATIVO' ? 'Monto sugerido (opcional)' : 'Monto'
              }}</mat-label>
              <input matInput formControlName="monto" inputmode="decimal" placeholder="350.00" />
              <mat-error>{{ error('monto') }}</mat-error>
            </mat-form-field>
          }
        </div>
        <mat-form-field class="completo">
          <mat-label>Requisitos</mat-label>
          <textarea matInput formControlName="requisitos" rows="2" maxlength="1000"></textarea>
        </mat-form-field>
        <div class="fila">
          <mat-form-field>
            <mat-label>Duración en minutos</mat-label>
            <input matInput type="number" min="1" max="1440" formControlName="duracionMin" />
            <mat-error>{{ error('duracionMin') }}</mat-error>
          </mat-form-field>
          <mat-checkbox formControlName="requiereCita">Requiere cita</mat-checkbox>
        </div>
        <app-horarios-editor [horarios]="form.controls.horarios" />
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-servicio" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .completo {
      width: 100%;
    }
    .fila {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: center;
    }
    @media (max-width: 480px) {
      .fila {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ServicioDialogo {
  protected readonly ref = inject(MatDialogRef<ServicioDialogo, boolean>);
  protected readonly servicio = inject<Servicio | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly servicios = inject(ServiciosService);
  private readonly notificar = inject(NotificarService);

  protected readonly formas = opcionesDe(ETIQUETAS_FORMA_COSTO);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [
      this.servicio?.nombre ?? '',
      [requerido('Escribe el nombre.'), Validators.maxLength(80)],
    ],
    formaCosto: [this.servicio?.formaCosto ?? ('MONTO' as FormaCosto)],
    monto: [this.servicio?.monto ?? ''],
    requisitos: [this.servicio?.requisitos ?? ''],
    duracionMin: [
      this.servicio?.duracionMin ?? (null as number | null),
      [Validators.min(1), Validators.max(1440)],
    ],
    requiereCita: [this.servicio?.requiereCita ?? false],
    horarios: new FormArray(
      (this.servicio?.horarios ?? []).map((h) => crearFormHorario(h)),
      { validators: sinRepetidos },
    ),
  });

  protected readonly forma = toSignal(this.form.controls.formaCosto.valueChanges, {
    initialValue: this.form.controls.formaCosto.value,
  });

  protected error(campo: 'nombre' | 'monto' | 'duracionMin') {
    const c = this.form.controls[campo];
    if (c.hasError('min') || c.hasError('max')) return 'La duración va de 1 a 1440 minutos.';
    return mensajeError(c);
  }

  /** RN-22: con costo → monto > 0; donativo → sugerido opcional y > 0; gratuito → sin monto. */
  private validarMonto(): string | null {
    const { formaCosto, monto } = this.form.getRawValue();
    const texto = monto.trim();
    if (formaCosto === 'GRATUITO' || (formaCosto === 'DONATIVO' && texto === '')) return null;
    if (texto === '') return 'Escribe el monto.';
    if (!FORMATO_DINERO.test(texto))
      return 'Monto no válido: hasta 2 decimales, sin signo ni comas.';
    if (Number(texto) <= 0) return 'El monto debe ser mayor que cero.';
    return null;
  }

  protected enviar() {
    const errorMonto = this.validarMonto();
    if (errorMonto) this.form.controls.monto.setErrors({ mensaje: errorMonto });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      formaCosto: v.formaCosto,
      monto: v.formaCosto === 'GRATUITO' || v.monto.trim() === '' ? null : v.monto.trim(),
      requisitos: textoONull(v.requisitos),
      duracionMin:
        v.duracionMin === null || String(v.duracionMin) === '' ? null : Number(v.duracionMin),
      requiereCita: v.requiereCita,
      horarios: v.horarios,
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.servicio
      ? this.servicios.editarServicio(this.servicio.id, datos)
      : this.servicios.crearServicio(datos);
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito(this.servicio ? 'Servicio modificado' : 'Servicio registrado');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const nombre = errorDeCampo(e, 'nombre');
        if (nombre) errorServidor(this.form.controls.nombre, nombre);
        else this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
