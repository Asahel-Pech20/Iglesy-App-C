import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
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
import { ETIQUETAS_TIPO_OBJETO, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError, requerido } from '@/app/core/validadores';
import { entero, numeroONull } from '@/app/features/iglesias/validadores-iglesia';
import type { CrearObjeto, ObjetoPatrimonial, TipoObjeto } from '@/app/tipos/patrimonio';
import { PatrimonioService } from './patrimonio.service';

const CAMPOS = [
  'descripcion',
  'tipo',
  'anio',
  'siglo',
  'material',
  'estadoConservacion',
  'ubicacionEnTemplo',
] as const;
type Campo = (typeof CAMPOS)[number];

/** RN-10 y RF-17: año exacto o, si no se conoce, siglo; con los dos, el año debe ser del siglo. */
const anioOSiglo: ValidatorFn = (grupo) => {
  const anio = numeroONull(grupo.get('anio')?.value);
  const siglo = numeroONull(grupo.get('siglo')?.value);
  if (anio === null && siglo === null) return { anioOSiglo: true };
  if (anio !== null && siglo !== null && Math.ceil(anio / 100) !== siglo)
    return { sigloDistinto: true };
  return null;
};

/**
 * Registra (RF-13) o edita (RF-14) un objeto del patrimonio de una iglesia.
 * Recibe `{ iglesiaId, objeto? }`; se cierra con `true` si guardó.
 */
@Component({
  selector: 'app-objeto-form-dialogo',
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
    MatCheckbox,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rejilla {
      display: grid;
      gap: 0 12px;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    }
  `,
  template: `
    <h2 mat-dialog-title>{{ datos.objeto ? 'Editar objeto' : 'Nuevo objeto' }}</h2>
    <mat-dialog-content>
      <form id="form-objeto" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>¿Qué es?</mat-label>
          <input matInput autocomplete="off" formControlName="descripcion" required />
          <mat-error>{{ error('descripcion') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo" required>
            @for (o of tipos; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
          <mat-hint>Los candelabros y cálices cuentan como orfebrería.</mat-hint>
          <mat-error>{{ error('tipo') }}</mat-error>
        </mat-form-field>
        <div class="rejilla">
          <mat-form-field>
            <mat-label>Año</mat-label>
            <input matInput inputmode="numeric" formControlName="anio" />
            <mat-error>{{ error('anio') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Siglo (18 = siglo XVIII)</mat-label>
            <input matInput inputmode="numeric" formControlName="siglo" />
            <mat-error>{{ error('siglo') }}</mat-error>
          </mat-form-field>
        </div>
        @if (form.touched && form.hasError('anioOSiglo')) {
          <p class="alerta alerta-peligro" role="alert" id="error-anio-siglo">
            Escribe el año o, si no se conoce, el siglo.
          </p>
        }
        @if (form.touched && form.hasError('sigloDistinto')) {
          <p class="alerta alerta-peligro" role="alert">El año no es de ese siglo.</p>
        }
        <div class="rejilla">
          <mat-form-field>
            <mat-label>Material</mat-label>
            <input matInput formControlName="material" required />
            <mat-error>{{ error('material') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Estado de conservación</mat-label>
            <input matInput formControlName="estadoConservacion" required />
            <mat-error>{{ error('estadoConservacion') }}</mat-error>
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Ubicación en el templo</mat-label>
          <input matInput formControlName="ubicacionEnTemplo" required />
          <mat-error>{{ error('ubicacionEnTemplo') }}</mat-error>
        </mat-form-field>
        <mat-checkbox formControlName="catalogadoInah">Catalogado por el INAH</mat-checkbox>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-objeto" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ObjetoFormDialogo {
  protected readonly ref = inject(MatDialogRef<ObjetoFormDialogo, boolean>);
  protected readonly datos = inject<{ iglesiaId: string; objeto?: ObjetoPatrimonial }>(
    MAT_DIALOG_DATA,
  );
  private readonly servicio = inject(PatrimonioService);
  private readonly notificar = inject(NotificarService);

  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_OBJETO);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly o = this.datos.objeto;
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      descripcion: [
        this.o?.descripcion ?? '',
        [requerido('Escribe qué es el objeto.'), maximo(200)],
      ],
      tipo: [(this.o?.tipo ?? '') as TipoObjeto | '', requerido('Elige el tipo de objeto.')],
      anio: [
        String(this.o?.anio ?? ''),
        entero(1, new Date().getFullYear(), 'Año no válido (no puede ser futuro).'),
      ],
      siglo: [String(this.o?.siglo ?? ''), entero(1, 21, 'Siglo no válido.')],
      material: [this.o?.material ?? '', [requerido('Escribe el material.'), maximo(120)]],
      estadoConservacion: [
        this.o?.estadoConservacion ?? '',
        [requerido('Escribe el estado de conservación.'), maximo(120)],
      ],
      ubicacionEnTemplo: [
        this.o?.ubicacionEnTemplo ?? '',
        [requerido('Escribe dónde está en el templo.'), maximo(150)],
      ],
      catalogadoInah: [this.o?.catalogadoInah ?? false],
    },
    { validators: anioOSiglo },
  );

  protected error(campo: Campo) {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos: CrearObjeto = {
      descripcion: v.descripcion.trim(),
      tipo: v.tipo as TipoObjeto,
      anio: numeroONull(v.anio),
      siglo: numeroONull(v.siglo),
      material: v.material.trim(),
      estadoConservacion: v.estadoConservacion.trim(),
      ubicacionEnTemplo: v.ubicacionEnTemplo.trim(),
      catalogadoInah: v.catalogadoInah,
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.o
      ? this.servicio.editarObjeto(this.datos.iglesiaId, this.o.id, datos)
      : this.servicio.crearObjeto(this.datos.iglesiaId, datos);
    peticion.subscribe({
      next: () => {
        this.notificar.exito('Objeto guardado');
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
