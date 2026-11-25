import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { LucideAngularModule, X } from 'lucide-angular';
import { OPCIONES_DIA } from '@/app/features/misas/formato-misas';
import type { HorarioSemanal } from '@/app/tipos/servicios';

export type FormHorario = FormGroup<{
  diaSemana: FormControl<number>;
  hora: FormControl<string>;
}>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function crearFormHorario(h?: HorarioSemanal): FormHorario {
  return new FormGroup({
    diaSemana: new FormControl(h?.diaSemana ?? 0, { nonNullable: true }),
    hora: new FormControl(h?.hora ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(HORA)],
    }),
  });
}

/** Sin el mismo día y hora dos veces (igual que el backend). */
export function sinRepetidos(c: AbstractControl): ValidationErrors | null {
  const lista = (c as FormArray<FormHorario>).getRawValue();
  const claves = lista.map((h) => `${h.diaSemana} ${h.hora}`);
  return new Set(claves).size === claves.length
    ? null
    : { mensaje: 'No repitas el mismo día y hora.' };
}

/** Lista editable de días y horas (RF-33, RF-36). */
@Component({
  selector: 'app-horarios-editor',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="horarios">
      <legend>{{ titulo() }}</legend>
      @for (grupo of horarios().controls; track grupo; let i = $index) {
        <div class="fila" [formGroup]="grupo">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Día</mat-label>
            <mat-select formControlName="diaSemana">
              @for (d of dias; track d.valor) {
                <mat-option [value]="d.valor">{{ d.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Hora</mat-label>
            <input matInput type="time" formControlName="hora" />
          </mat-form-field>
          <button
            matIconButton
            type="button"
            [attr.aria-label]="'Quitar el horario ' + (i + 1)"
            (click)="horarios().removeAt(i)"
          >
            <lucide-icon [img]="iconoQuitar" [size]="18" />
          </button>
        </div>
      }
      @if (horarios().errors?.['mensaje']; as m) {
        <p class="error" role="alert">{{ m }}</p>
      }
      @if (faltaHora()) {
        <p class="error" role="alert">Indica la hora de cada horario con el formato HH:mm.</p>
      }
      <button matButton="tonal" type="button" (click)="agregar()">Agregar día y hora</button>
    </fieldset>
  `,
  styles: `
    .horarios {
      display: grid;
      gap: 8px;
      margin: 8px 0;
      padding: 12px;
      border: 1px solid var(--borde, #cbd5e1);
      border-radius: 8px;
    }
    legend {
      padding: 0 4px;
      font-size: 14px;
    }
    .fila {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      align-items: center;
    }
    .error {
      margin: 0;
      font-size: 12px;
      color: var(--peligro);
    }
  `,
})
export class HorariosEditor {
  readonly horarios = input.required<FormArray<FormHorario>>();
  readonly titulo = input('Días y horarios');

  protected readonly dias = OPCIONES_DIA;
  protected readonly iconoQuitar = X;

  protected faltaHora() {
    return this.horarios().controls.some((g) => g.controls.hora.invalid && g.controls.hora.touched);
  }

  protected agregar() {
    this.horarios().push(crearFormHorario());
  }
}
