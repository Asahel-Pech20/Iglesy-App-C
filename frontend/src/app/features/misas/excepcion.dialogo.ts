import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { normalizarError } from '@/app/core/api';
import { DIAS_SEMANA } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido } from '@/app/core/validadores';
import type { TipoExcepcionMisa } from '@/app/tipos/misas';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Día de la semana (0 = domingo) de una fecha «yyyy-MM-dd», sin depender de la zona del navegador. */
const diaDe = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/**
 * E3-25 (supuesto P-33): marca una fecha en la que una misa del horario no se celebra o se celebra a
 * otra hora, con su motivo. El servidor revisa el día, que no esté ya celebrada y, con otra hora, que
 * el padre no tenga otra misa que se empalme (409).
 */
@Component({
  selector: 'app-excepcion-misa-dialogo',
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
    <h2 mat-dialog-title>Día sin misa u otra hora</h2>
    <mat-dialog-content>
      <form id="form-excepcion" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Misa del horario</mat-label>
          <mat-select formControlName="horarioMisaId" required>
            @for (m of horario(); track m.id) {
              <mat-option [value]="m.id">
                {{ dias[m.diaSemana] }} {{ m.hora }} · {{ nombre(m.padre) }}
              </mat-option>
            }
          </mat-select>
          <mat-error>{{ error('horarioMisaId') }}</mat-error>
        </mat-form-field>
        <div class="fila">
          <mat-form-field>
            <mat-label>Fecha</mat-label>
            <input matInput type="date" formControlName="fecha" required />
            @if (diaEsperado(); as d) {
              <mat-hint>Debe ser {{ d }}.</mat-hint>
            }
            <mat-error>{{ error('fecha') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Qué pasa ese día</mat-label>
            <mat-select formControlName="tipo" required>
              <mat-option value="SIN_MISA">No hay misa</mat-option>
              <mat-option value="OTRA_HORA">Se celebra a otra hora</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        @if (tipo() === 'OTRA_HORA') {
          <mat-form-field class="completo">
            <mat-label>Hora nueva (local de la iglesia)</mat-label>
            <input matInput type="time" formControlName="horaNueva" required />
            <mat-error>{{ error('horaNueva') }}</mat-error>
          </mat-form-field>
        }
        <mat-form-field class="completo">
          <mat-label>Motivo</mat-label>
          <textarea matInput rows="2" maxlength="300" formControlName="motivo" required></textarea>
          <mat-hint>Lo verá el público en la ficha de la iglesia.</mat-hint>
          <mat-error>{{ error('motivo') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-excepcion" [disabled]="enviando()">
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
    }
    @media (max-width: 480px) {
      .fila {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ExcepcionMisaDialogo {
  protected readonly ref = inject(MatDialogRef<ExcepcionMisaDialogo, boolean>);
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly nombre = nombrePadre;
  protected readonly listaHorario = rxResource({ stream: () => this.servicio.listarHorario() });
  protected readonly horario = computed(() => valorDe(this.listaHorario) ?? []);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    horarioMisaId: ['', requerido('Elige la misa del horario.')],
    fecha: ['', requerido('Indica la fecha.')],
    tipo: ['SIN_MISA' as TipoExcepcionMisa],
    horaNueva: ['', Validators.pattern(HORA)],
    motivo: ['', [requerido('Escribe el motivo.'), Validators.minLength(3)]],
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly tipo = computed(() => this.valores().tipo);
  private readonly misaElegida = computed(() =>
    this.horario().find((m) => m.id === this.valores().horarioMisaId),
  );
  protected readonly diaEsperado = computed(() => {
    const m = this.misaElegida();
    return m ? (DIAS_SEMANA[m.diaSemana]?.toLowerCase() ?? null) : null;
  });

  protected error(campo: 'horarioMisaId' | 'fecha' | 'horaNueva' | 'motivo') {
    const c = this.form.controls[campo];
    if (c.hasError('diaIncorrecto')) return `La fecha debe ser ${this.diaEsperado()}.`;
    if (campo === 'horaNueva' && c.hasError('required')) return 'Indica la hora nueva.';
    if (c.hasError('pattern')) return 'Usa la hora con el formato HH:mm.';
    if (c.hasError('mismaHora')) return 'Elige una hora distinta a la del horario.';
    if (c.hasError('minlength')) return 'Escribe al menos 3 caracteres.';
    return mensajeError(c);
  }

  /** Revisiones que dependen de la misa elegida; el servidor las vuelve a hacer. */
  private revisarCruces(): boolean {
    const v = this.form.getRawValue();
    const misa = this.misaElegida();
    const { fecha, horaNueva } = this.form.controls;
    if (misa && v.fecha && diaDe(v.fecha) !== misa.diaSemana) {
      fecha.setErrors({ diaIncorrecto: true });
    }
    if (v.tipo === 'OTRA_HORA') {
      if (!v.horaNueva) horaNueva.setErrors({ mensaje: 'Indica la hora nueva.' });
      else if (misa && v.horaNueva === misa.hora) horaNueva.setErrors({ mismaHora: true });
    }
    return this.form.valid;
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.revisarCruces()) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .crearExcepcion({
        horarioMisaId: v.horarioMisaId,
        fecha: v.fecha,
        tipo: v.tipo,
        ...(v.tipo === 'OTRA_HORA' ? { horaNueva: v.horaNueva } : {}),
        motivo: v.motivo.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.notificar.exito(
            v.tipo === 'SIN_MISA' ? 'Día sin misa guardado' : 'Cambio de hora guardado',
          );
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          // 409: ya celebrada, ya hay una excepción o el padre choca a la hora nueva; 422: otro día
          this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
