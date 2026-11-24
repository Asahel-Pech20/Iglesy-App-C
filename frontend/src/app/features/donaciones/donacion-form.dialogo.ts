import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
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
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { format } from 'date-fns';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_CONCEPTO, ETIQUETAS_METODO, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError, requerido, textoONull } from '@/app/core/validadores';
import { SelectorMiembros } from '@/app/features/miembros/selector-miembros';
import type {
  ConceptoDonacion,
  Donacion,
  GuardarDonacion,
  MetodoPago,
} from '@/app/tipos/donaciones';
import { DonacionesService } from './donaciones.service';

// Espejo de backend/src/modules/donaciones/donaciones.schemas.ts.
// El monto viaja como string con hasta 2 decimales; nunca se convierte a number para sumar.
const hoy = () => format(new Date(), 'yyyy-MM-dd');

const validarMonto: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  if (v === '') return { mensaje: 'Escribe el monto.' };
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v)) return { mensaje: 'Monto no válido (hasta 2 decimales).' };
  return Number(v) > 0 ? null : { mensaje: 'El monto debe ser mayor que cero.' };
};

const noFutura: ValidatorFn = (c) =>
  c.value && String(c.value) > hoy() ? { mensaje: 'La fecha no puede ser futura.' } : null;

/** "Otro" exige describir el concepto */
const detalleSiOtro: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  c.parent?.get('concepto')?.value === 'OTRO' && String(c.value ?? '').trim() === ''
    ? { mensaje: 'Describe el concepto cuando es "Otro".' }
    : null;

const CAMPOS_SERVIDOR = ['fecha', 'monto', 'conceptoDetalle', 'referencia', 'notas'] as const;
type Campo = (typeof CAMPOS_SERVIDOR)[number];

/** Registrar / editar aportación, pensado para captura rápida (F4-02, F4-03). Recibe la donación a editar, o nada. */
@Component({
  selector: 'app-donacion-form-dialogo',
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
    MatSlideToggle,
    SelectorMiembros,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ donacion ? 'Editar aportación' : 'Registrar aportación' }}</h2>
    <mat-dialog-content>
      <p class="texto-suave">
        {{
          donacion
            ? 'Las aportaciones anuladas no se pueden editar.'
            : 'Registra una aportación económica. Si no se conoce al donante, márcala como anónima.'
        }}
      </p>
      <form id="form-donacion" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="rejilla">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro doble" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Fecha</mat-label>
          <input matInput type="date" formControlName="fecha" required />
          <mat-error>{{ error('fecha') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Monto</mat-label>
          <input
            matInput
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            formControlName="monto"
            required
          />
          <mat-error>{{ error('monto') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Concepto</mat-label>
          <mat-select formControlName="concepto" required>
            @for (o of opcionesConcepto; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Método de recepción</mat-label>
          <mat-select formControlName="metodo" required>
            @for (o of opcionesMetodo; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (concepto() === 'OTRO') {
          <mat-form-field class="doble">
            <mat-label>Describe el concepto</mat-label>
            <input
              matInput
              autocomplete="off"
              maxlength="150"
              formControlName="conceptoDetalle"
              required
            />
            <mat-error>{{ error('conceptoDetalle') }}</mat-error>
          </mat-form-field>
        }

        <div class="donante doble">
          <div class="anonima">
            <div>
              <p class="titulo-anonima">Aportación anónima</p>
              <p class="texto-suave pequeno">No se asocia a ningún miembro.</p>
            </div>
            <mat-slide-toggle
              formControlName="anonima"
              aria-label="Aportación anónima"
              (change)="alCambiarAnonima($event.checked)"
            />
          </div>
          @if (!anonima()) {
            <app-selector-miembros
              etiqueta="Donante"
              placeholder="Busca un miembro…"
              [(seleccion)]="miembroIds"
            />
            @if (errorDonante()) {
              <p class="texto-peligro pequeno" role="alert">{{ errorDonante() }}</p>
            }
          }
        </div>

        <mat-form-field>
          <mat-label>Referencia</mat-label>
          <input matInput autocomplete="off" maxlength="100" formControlName="referencia" />
          <mat-hint>Folio, cheque, SPEI…</mat-hint>
          <mat-error>{{ error('referencia') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Notas</mat-label>
          <textarea matInput rows="2" maxlength="1000" formControlName="notas"></textarea>
          <mat-error>{{ error('notas') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      @if (!donacion) {
        <button matButton="tonal" type="button" [disabled]="enviando()" (click)="enviar(true)">
          Guardar y registrar otra
        </button>
      }
      <button matButton="filled" type="submit" form="form-donacion" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : donacion ? 'Guardar' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .rejilla {
      display: grid;
      gap: 4px 16px;
    }
    .donante {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid var(--marco);
      border-radius: 4px;
    }
    .anonima {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .anonima p,
    .donante > p {
      margin: 0;
    }
    .titulo-anonima {
      font-weight: 500;
    }
    .pequeno {
      font-size: 12px;
    }
    @media (min-width: 640px) {
      .rejilla {
        grid-template-columns: 1fr 1fr;
      }
      .doble {
        grid-column: span 2;
      }
    }
  `,
})
export class DonacionFormDialogo {
  protected readonly donacion = inject<Donacion | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly ref = inject(MatDialogRef<DonacionFormDialogo, boolean>);
  private readonly servicio = inject(DonacionesService);
  private readonly notificar = inject(NotificarService);

  protected readonly opcionesConcepto = opcionesDe(ETIQUETAS_CONCEPTO);
  protected readonly opcionesMetodo = opcionesDe(ETIQUETAS_METODO);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly miembroIds = signal<string[]>(
    this.donacion?.miembro ? [this.donacion.miembro.id] : [],
  );
  /** Mensaje bajo el selector de donante; se limpia al elegir */
  protected readonly errorDonante = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    fecha: [this.donacion?.fecha ?? hoy(), [requerido('Selecciona la fecha.'), noFutura]],
    monto: [this.donacion?.monto ?? '', validarMonto],
    concepto: ['DIEZMO' as ConceptoDonacion, requerido('Elige el concepto.')],
    conceptoDetalle: [this.donacion?.conceptoDetalle ?? '', [detalleSiOtro, maximo(150)]],
    metodo: ['EFECTIVO' as MetodoPago, requerido('Elige el método de recepción.')],
    anonima: [this.donacion?.anonima ?? false],
    referencia: [this.donacion?.referencia ?? '', maximo(100)],
    notas: [this.donacion?.notas ?? '', maximo(1000)],
  });
  protected readonly concepto = toSignal(this.form.controls.concepto.valueChanges, {
    initialValue: this.form.controls.concepto.value,
  });
  protected readonly anonima = toSignal(this.form.controls.anonima.valueChanges, {
    initialValue: this.form.controls.anonima.value,
  });

  constructor() {
    if (this.donacion) {
      this.form.patchValue({ concepto: this.donacion.concepto, metodo: this.donacion.metodo });
    }
    this.form.controls.concepto.valueChanges.subscribe(() =>
      this.form.controls.conceptoDetalle.updateValueAndValidity(),
    );
  }

  protected error(campo: Campo) {
    return mensajeError(this.form.controls[campo]);
  }

  protected alCambiarAnonima(valor: boolean) {
    // Anónima ⇒ sin donante: se limpia el selector
    if (valor) {
      this.miembroIds.set([]);
      this.errorDonante.set(null);
    }
  }

  protected enviar(registrarOtra = false) {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const miembroId = this.miembroIds()[0] ?? null;
    this.errorDonante.set(
      !v.anonima && !miembroId ? 'Elige el donante o marca la aportación como anónima.' : null,
    );
    if (this.form.invalid || this.errorDonante()) return;

    const datos: GuardarDonacion = {
      fecha: v.fecha,
      monto: v.monto.trim(),
      concepto: v.concepto,
      conceptoDetalle: v.concepto === 'OTRO' ? v.conceptoDetalle.trim() : null,
      metodo: v.metodo,
      miembroId: v.anonima ? null : miembroId,
      anonima: v.anonima,
      referencia: textoONull(v.referencia),
      notas: textoONull(v.notas),
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.donacion
      ? this.servicio.editar(this.donacion.id, datos)
      : this.servicio.crear(datos);
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito(this.donacion ? 'Aportación guardada' : 'Aportación registrada');
        if (registrarOtra && !this.donacion) {
          // Conserva fecha, concepto y método para capturar la siguiente más rápido
          const { fecha, concepto, metodo } = v;
          this.form.reset({ fecha, concepto, metodo });
          this.miembroIds.set([]);
          this.errorDonante.set(null);
        } else {
          this.ref.close(true);
        }
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const conCampo = CAMPOS_SERVIDOR.filter((campo) => {
          const mensaje = errorDeCampo(e, campo);
          if (mensaje) errorServidor(this.form.controls[campo], mensaje);
          return Boolean(mensaje);
        });
        const mensajeDonante = errorDeCampo(e, 'miembroId');
        if (mensajeDonante) this.errorDonante.set(mensajeDonante);
        if (conCampo.length === 0 && !mensajeDonante)
          this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
