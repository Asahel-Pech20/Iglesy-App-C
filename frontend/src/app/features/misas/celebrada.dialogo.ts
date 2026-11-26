import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
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
import { normalizarError } from '@/app/core/api';
import { DIAS_SEMANA } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido } from '@/app/core/validadores';
import type { HorarioMisa } from '@/app/tipos/misas';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

/** Día de la semana (0 = domingo) de una fecha «yyyy-MM-dd», sin zona horaria. */
const diaDe = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/**
 * Registra una misa celebrada a partir del horario (RF-48). Si la dio otro padre, es una
 * sustitución y lleva motivo; se guarda quién hizo el cambio y no se edita (RF-49, RF-50).
 */
@Component({
  selector: 'app-celebrada-dialogo',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registrar misa celebrada</h2>
    <mat-dialog-content>
      <form id="form-celebrada" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Misa del horario</mat-label>
          <mat-select formControlName="horarioMisaId" required>
            @for (m of horario(); track m.id) {
              <mat-option [value]="m.id">
                {{ dias[m.diaSemana] }} {{ m.hora }} · {{ padre(m.padre) }}
              </mat-option>
            }
          </mat-select>
          <mat-error>{{ error('horarioMisaId') }}</mat-error>
        </mat-form-field>
        <mat-form-field class="completo">
          <mat-label>Fecha</mat-label>
          <input matInput type="date" formControlName="fecha" [max]="hoy" required />
          @if (elegida(); as m) {
            <mat-hint>Debe ser {{ dias[m.diaSemana]?.toLowerCase() }}.</mat-hint>
          }
          <mat-error>{{ error('fecha') }}</mat-error>
        </mat-form-field>
        <mat-checkbox formControlName="hayCambio">La dio otro padre (sustitución)</mat-checkbox>
        @if (form.controls.hayCambio.value) {
          <mat-form-field class="completo con-margen">
            <mat-label>Padre que la dio</mat-label>
            <mat-select formControlName="padreId">
              @for (p of sustitutos(); track p.id) {
                <mat-option [value]="p.id">{{ padre(p) }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ error('padreId') }}</mat-error>
          </mat-form-field>
          <mat-form-field class="completo">
            <mat-label>Motivo</mat-label>
            <textarea matInput formControlName="motivo" rows="2" maxlength="300"></textarea>
            <mat-hint>Queda registrado con tu nombre y no se puede editar.</mat-hint>
            <mat-error>{{ error('motivo') }}</mat-error>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-celebrada" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .completo {
      width: 100%;
    }
    .con-margen {
      margin-top: 12px;
    }
  `,
})
export class CelebradaDialogo {
  protected readonly ref = inject(MatDialogRef<CelebradaDialogo, boolean>);
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly padre = nombrePadre;
  protected readonly hoy = format(new Date(), 'yyyy-MM-dd');
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly consultaHorario = rxResource({ stream: () => this.servicio.listarHorario() });
  protected readonly horario = computed(() => valorDe(this.consultaHorario) ?? []);
  private readonly consultaPadres = rxResource({ stream: () => this.servicio.listarPadres() });

  protected readonly form = inject(NonNullableFormBuilder).group({
    horarioMisaId: ['', requerido('Elige la misa del horario.')],
    fecha: ['', requerido('Indica la fecha.')],
    hayCambio: [false],
    padreId: [''],
    motivo: [''],
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly elegida = computed<HorarioMisa | undefined>(() =>
    this.horario().find((m) => m.id === this.valores().horarioMisaId),
  );
  /** Cualquier padre de la iglesia menos el programado */
  protected readonly sustitutos = computed(() =>
    (valorDe(this.consultaPadres) ?? []).filter((p) => p.id !== this.elegida()?.padre.id),
  );

  /** La fecha cae en el día del horario y no es futura; la sustitución lleva padre y motivo. */
  private validarCruzado() {
    const v = this.form.getRawValue();
    const c = this.form.controls;
    const misa = this.horario().find((m) => m.id === v.horarioMisaId);
    if (v.fecha && v.fecha > this.hoy) {
      c.fecha.setErrors({ mensaje: 'Solo se registra una misa que ya se celebró.' });
    } else if (v.fecha && misa && diaDe(v.fecha) !== misa.diaSemana) {
      c.fecha.setErrors({
        mensaje: `Esa fecha no es ${DIAS_SEMANA[misa.diaSemana]!.toLowerCase()}.`,
      });
    }
    if (v.hayCambio && !v.padreId) c.padreId.setErrors({ mensaje: 'Elige el padre que la dio.' });
    if (v.hayCambio && !v.motivo.trim()) c.motivo.setErrors({ mensaje: 'Escribe el motivo.' });
  }

  protected error(campo: 'horarioMisaId' | 'fecha' | 'padreId' | 'motivo') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.validarCruzado();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .registrarDesdeHorario({
        horarioMisaId: v.horarioMisaId,
        fecha: v.fecha,
        ...(v.hayCambio ? { padreId: v.padreId, motivo: v.motivo.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.notificar.exito(v.hayCambio ? 'Misa y sustitución registradas' : 'Misa registrada');
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
