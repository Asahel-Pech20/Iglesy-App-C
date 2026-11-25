import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { ETIQUETAS_TIPO_PLATICA, nombrePadre } from '@/app/features/misas/formato-misas';
import { MisasService } from '@/app/features/misas/misas.service';
import type { Platica, TipoPlatica } from '@/app/tipos/servicios';
import { crearFormHorario, HorariosEditor, sinRepetidos } from './horarios-editor';
import { FORMATO_DINERO, ServiciosService } from './servicios.service';

/**
 * Registra o modifica una plática de preparación (RF-36, RF-37): tipo, días y hora, sesiones,
 * costo exacto (RN-25), cupo informativo (P-13), lugar y quién la da (texto, o un padre: P-14).
 */
@Component({
  selector: 'app-platica-dialogo',
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
    HorariosEditor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ platica ? 'Modificar plática' : 'Nueva plática' }}</h2>
    <mat-dialog-content>
      <form id="form-platica" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="completo">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo" required>
            @for (t of tipos; track t.valor) {
              <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="fila">
          <mat-form-field>
            <mat-label>Sesiones</mat-label>
            <input matInput type="number" min="1" max="100" formControlName="sesiones" required />
            <mat-error>{{ error('sesiones') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Cupo (personas)</mat-label>
            <input matInput type="number" min="1" max="10000" formControlName="cupo" required />
            <mat-error>{{ error('cupo') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Costo</mat-label>
            <input matInput formControlName="costo" inputmode="decimal" placeholder="0.00" />
            <mat-hint>0 = gratuita</mat-hint>
            <mat-error>{{ error('costo') }}</mat-error>
          </mat-form-field>
        </div>
        <mat-form-field class="completo">
          <mat-label>Lugar</mat-label>
          <input matInput formControlName="lugar" maxlength="200" required />
          <mat-error>{{ error('lugar') }}</mat-error>
        </mat-form-field>
        <div class="fila dos">
          <mat-form-field>
            <mat-label>Quién la da</mat-label>
            <input matInput formControlName="imparte" maxlength="200" required />
            <mat-hint>Catequista, matrimonio, padre…</mat-hint>
            <mat-error>{{ error('imparte') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Padre (opcional)</mat-label>
            <mat-select formControlName="padreId">
              <mat-option [value]="null">Ninguno</mat-option>
              @for (p of padres(); track p.id) {
                <mat-option [value]="p.id">{{ nombre(p) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <app-horarios-editor
          [horarios]="form.controls.horarios"
          titulo="Días y hora en que se imparte"
        />
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-platica" [disabled]="enviando()">
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
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .fila.dos {
      grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 480px) {
      .fila,
      .fila.dos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PlaticaDialogo {
  protected readonly ref = inject(MatDialogRef<PlaticaDialogo, boolean>);
  protected readonly platica = inject<Platica | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly servicios = inject(ServiciosService);
  private readonly misas = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_PLATICA);
  protected readonly nombre = nombrePadre;
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly consultaPadres = rxResource({ stream: () => this.misas.listarPadres() });
  protected readonly padres = computed(() => valorDe(this.consultaPadres) ?? []);

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: [this.platica?.tipo ?? ('PREBAUTISMAL' as TipoPlatica)],
    sesiones: [
      this.platica?.sesiones ?? 1,
      [Validators.required, Validators.min(1), Validators.max(100)],
    ],
    cupo: [
      this.platica?.cupo ?? 20,
      [Validators.required, Validators.min(1), Validators.max(10000)],
    ],
    costo: [this.platica?.costo ?? '0', [requerido('Escribe el costo (0 si es gratuita).')]],
    lugar: [this.platica?.lugar ?? '', [requerido('Escribe dónde es.')]],
    imparte: [this.platica?.imparte ?? '', [requerido('Escribe quién la da.')]],
    padreId: [this.platica?.padre?.id ?? (null as string | null)],
    horarios: new FormArray(
      (this.platica?.horarios ?? [{ diaSemana: 0, hora: '' }]).map((h) => crearFormHorario(h)),
      { validators: [sinRepetidos, Validators.minLength(1)] },
    ),
  });

  protected error(campo: 'sesiones' | 'cupo' | 'costo' | 'lugar' | 'imparte') {
    const c = this.form.controls[campo];
    if (campo === 'sesiones' && c.invalid) return 'Las sesiones van de 1 a 100.';
    if (campo === 'cupo' && c.invalid) return 'El cupo va de 1 a 10000 personas.';
    return mensajeError(c);
  }

  protected enviar() {
    const costo = this.form.controls.costo.value.trim();
    if (costo !== '' && !FORMATO_DINERO.test(costo)) {
      this.form.controls.costo.setErrors({
        mensaje: 'Costo no válido: hasta 2 decimales, sin signo ni comas.',
      });
    }
    if (this.form.controls.horarios.length === 0) {
      this.errorGeneral.set('Indica al menos un día y hora.');
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos = {
      ...v,
      sesiones: Number(v.sesiones),
      cupo: Number(v.cupo),
      costo,
      lugar: v.lugar.trim(),
      imparte: v.imparte.trim(),
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.platica
      ? this.servicios.editarPlatica(this.platica.id, datos)
      : this.servicios.crearPlatica(datos);
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito(this.platica ? 'Plática modificada' : 'Plática registrada');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
