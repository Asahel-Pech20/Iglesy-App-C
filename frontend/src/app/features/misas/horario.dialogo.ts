import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MatOption, MatSelect } from '@angular/material/select';
import { normalizarError } from '@/app/core/api';
import { opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido } from '@/app/core/validadores';
import type { HorarioMisa, IdiomaMisa } from '@/app/tipos/misas';
import type { TipoMisa } from '@/app/tipos/servicios';
import { ETIQUETAS_IDIOMA, ETIQUETAS_TIPO_MISA, nombrePadre, OPCIONES_DIA } from './formato-misas';
import { MisasService } from './misas.service';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Programa o cambia una misa del horario semanal (RF-42, RF-43, RF-46). Si el padre ya tiene otra
 * misa que se empalma, aunque sea en otra iglesia, el servidor responde 409 y aquí se muestra con
 * cuál choca (RF-45).
 */
@Component({
  selector: 'app-horario-misa-dialogo',
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
    <h2 mat-dialog-title>{{ misa ? 'Cambiar misa' : 'Programar misa' }}</h2>
    <mat-dialog-content>
      <form id="form-horario" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <div class="fila">
          <mat-form-field>
            <mat-label>Día</mat-label>
            <mat-select formControlName="diaSemana" required>
              @for (d of dias; track d.valor) {
                <mat-option [value]="d.valor">{{ d.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Hora (local de la iglesia)</mat-label>
            <input matInput type="time" formControlName="hora" required />
            <mat-error>{{ error('hora') }}</mat-error>
          </mat-form-field>
        </div>
        <div class="fila">
          <mat-form-field>
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo" required>
              @for (t of tipos; track t.valor) {
                <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Idioma</mat-label>
            <mat-select formControlName="idioma" required>
              @for (i of idiomas; track i.valor) {
                <mat-option [value]="i.valor">{{ i.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field class="completo">
          <mat-label>Padre que la oficia</mat-label>
          <mat-select formControlName="padreId" required>
            @for (p of padres(); track p.id) {
              <mat-option [value]="p.id">{{ nombre(p) }}</mat-option>
            }
          </mat-select>
          @if (padres().length === 0 && !listaPadres.isLoading()) {
            <mat-hint>Primero registra o asocia un padre en la pestaña «Padres».</mat-hint>
          }
          <mat-error>{{ error('padreId') }}</mat-error>
        </mat-form-field>
        <mat-form-field class="completo">
          <mat-label>Duración en minutos (opcional)</mat-label>
          <input matInput type="number" min="1" max="720" formControlName="duracionMin" />
          <mat-hint>Si la dejas vacía, la misa dura una hora.</mat-hint>
          <mat-error>{{ error('duracionMin') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-horario" [disabled]="enviando()">
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
export class HorarioMisaDialogo {
  protected readonly ref = inject(MatDialogRef<HorarioMisaDialogo, boolean>);
  protected readonly misa = inject<HorarioMisa | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly dias = OPCIONES_DIA;
  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_MISA);
  protected readonly idiomas = opcionesDe(ETIQUETAS_IDIOMA);
  protected readonly nombre = nombrePadre;

  protected readonly listaPadres = rxResource({ stream: () => this.servicio.listarPadres() });
  protected readonly padres = computed(() => valorDe(this.listaPadres) ?? []);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    diaSemana: [this.misa?.diaSemana ?? 0, requerido('Elige el día.')],
    hora: [this.misa?.hora ?? '', [requerido('Indica la hora.'), Validators.pattern(HORA)]],
    tipo: [this.misa?.tipo ?? ('DOMINICAL' as TipoMisa), requerido('Elige el tipo.')],
    idioma: [this.misa?.idioma ?? ('ESPANOL' as IdiomaMisa), requerido('Elige el idioma.')],
    padreId: [this.misa?.padre.id ?? '', requerido('Elige el padre que la oficia.')],
    duracionMin: [
      this.misa?.duracionMin ?? (null as number | null),
      [Validators.min(1), Validators.max(720)],
    ],
  });

  protected error(campo: 'hora' | 'padreId' | 'duracionMin') {
    const c = this.form.controls[campo];
    if (c.hasError('pattern')) return 'Usa la hora con el formato HH:mm.';
    if (c.hasError('min') || c.hasError('max')) return 'La duración va de 1 a 720 minutos.';
    return mensajeError(c);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos = {
      ...v,
      duracionMin:
        v.duracionMin === null || String(v.duracionMin) === '' ? null : Number(v.duracionMin),
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.misa
      ? this.servicio.cambiarMisa(this.misa.id, datos)
      : this.servicio.programar(datos);
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito(this.misa ? 'Misa cambiada' : 'Misa programada');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        // 409: el padre ya tiene una misa que se empalma; el mensaje dice cuál (RF-45)
        this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
