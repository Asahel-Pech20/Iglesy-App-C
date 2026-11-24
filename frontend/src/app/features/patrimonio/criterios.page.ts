import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidatorFn,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { normalizarError } from '@/app/core/api';
import { ETIQUETAS_GRUPO_OBJETO, formatearFechaHora } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido } from '@/app/core/validadores';
import type { CriteriosIndice, GrupoObjeto, VersionCriterios } from '@/app/tipos/patrimonio';
import { PatrimonioService } from './patrimonio.service';

const GRUPOS = Object.keys(ETIQUETAS_GRUPO_OBJETO) as GrupoObjeto[];

/** Número ≥ 0 con un decimal como máximo (ADR-0005: el cálculo es en décimas). */
const puntos: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  if (v === '') return { mensaje: 'Escribe un número.' };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { mensaje: 'Número no válido.' };
  return Math.abs(n * 10 - Math.round(n * 10)) < 1e-9
    ? null
    : { mensaje: 'Un decimal como máximo.' };
};

type Fila = FormGroup<{ a: FormControl<string>; b: FormControl<string> }>;

/**
 * /criterios-indice — la Coordinación consulta y cambia los criterios del índice (E2-10, RF-22).
 * Al guardar se crea una versión nueva y el índice de todas las iglesias cambia (RN-14).
 */
@Component({
  selector: 'app-criterios',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    PuedeDirective,
    PageHeader,
    EstadoError,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .fila {
      display: grid;
      gap: 0 12px;
      grid-template-columns: 1fr 1fr auto;
      align-items: start;
    }
    .rejilla {
      display: grid;
      gap: 0 12px;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0 0 16px;
    }
    legend {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .suave {
      color: var(--texto-suave);
      font-size: 12px;
    }
  `,
  template: `
    <app-page-header
      titulo="Criterios del índice"
      descripcion="Puntos por antigüedad, multiplicadores por tipo, puntos del INAH y distinciones."
    />

    @if (actual.isLoading() && !actual.hasValue()) {
      <app-esqueleto [filas]="6" [columnas]="2" />
    } @else if (actual.error()) {
      <app-estado-error [error]="actual.error()" (reintentar)="actual.reload()" />
    } @else {
      <section class="tarjeta">
        <p class="suave">
          {{
            version()?.vigenteDesde
              ? 'Vigentes desde ' +
                fechaHora(version()!.vigenteDesde) +
                ' (' +
                (version()!.creadoPor?.nombre ?? '') +
                ')'
              : 'Vigentes: los criterios del caso (aún no se han cambiado).'
          }}
          Al guardar, el índice y la distinción de todas las iglesias se recalculan.
        </p>
        <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
          @if (errorGeneral()) {
            <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
          }
          <fieldset formArrayName="rangosEdad">
            <legend>Puntos por antigüedad (desde cuántos años)</legend>
            @for (f of form.controls.rangosEdad.controls; track f; let i = $index) {
              <div class="fila" [formGroupName]="i">
                <mat-form-field>
                  <mat-label>Desde (años)</mat-label>
                  <input matInput inputmode="numeric" formControlName="a" />
                  <mat-error>{{ err(f.controls.a) }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Puntos</mat-label>
                  <input matInput inputmode="decimal" formControlName="b" />
                  <mat-error>{{ err(f.controls.b) }}</mat-error>
                </mat-form-field>
                <button matButton type="button" (click)="quitar(form.controls.rangosEdad, i)">
                  Quitar
                </button>
              </div>
            }
            <button matButton type="button" (click)="agregar(form.controls.rangosEdad)">
              Agregar rango
            </button>
          </fieldset>

          <fieldset formGroupName="multiplicadores">
            <legend>Multiplicador por tipo de objeto</legend>
            <div class="rejilla">
              @for (g of grupos; track g) {
                <mat-form-field>
                  <mat-label>{{ etiquetasGrupo[g] }}</mat-label>
                  <input matInput inputmode="decimal" [formControlName]="g" />
                  <mat-error>{{ err(form.controls.multiplicadores.controls[g]) }}</mat-error>
                </mat-form-field>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend>Catalogado por el INAH</legend>
            <mat-form-field>
              <mat-label>Puntos que suma</mat-label>
              <input matInput inputmode="decimal" formControlName="puntosInah" />
              <mat-error>{{ err(form.controls.puntosInah) }}</mat-error>
            </mat-form-field>
          </fieldset>

          <fieldset formArrayName="distinciones">
            <legend>Distinciones (de mayor a menor mínimo)</legend>
            @for (f of form.controls.distinciones.controls; track f; let i = $index) {
              <div class="fila" [formGroupName]="i">
                <mat-form-field>
                  <mat-label>Desde (puntos)</mat-label>
                  <input matInput inputmode="decimal" formControlName="a" />
                  <mat-error>{{ err(f.controls.a) }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Nombre</mat-label>
                  <input matInput formControlName="b" />
                  <mat-error>{{ err(f.controls.b) }}</mat-error>
                </mat-form-field>
                <button matButton type="button" (click)="quitar(form.controls.distinciones, i)">
                  Quitar
                </button>
              </div>
            }
            <button matButton type="button" (click)="agregar(form.controls.distinciones, true)">
              Agregar distinción
            </button>
          </fieldset>

          <button
            *appPuede="'criterios:editar'"
            matButton="filled"
            type="submit"
            [disabled]="enviando()"
          >
            {{ enviando() ? 'Guardando…' : 'Guardar criterios' }}
          </button>
        </form>
      </section>

      <section class="tarjeta" aria-label="Historial de criterios">
        <h2>Historial</h2>
        @if (historial().length === 0) {
          <p class="suave">Todavía no hay versiones guardadas.</p>
        } @else {
          <div class="contenedor-tabla">
            <table class="tabla-simple" aria-label="Versiones de los criterios">
              <thead>
                <tr>
                  <th scope="col">Desde</th>
                  <th scope="col">Quién</th>
                  <th scope="col">Puntos INAH</th>
                </tr>
              </thead>
              <tbody>
                @for (v of historial(); track v.id) {
                  <tr>
                    <td>{{ fechaHora(v.vigenteDesde) }}</td>
                    <td>{{ v.creadoPor?.nombre }}</td>
                    <td>{{ v.puntosInah }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class CriteriosPage {
  private readonly servicio = inject(PatrimonioService);
  private readonly notificar = inject(NotificarService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupos = GRUPOS;
  protected readonly etiquetasGrupo = ETIQUETAS_GRUPO_OBJETO;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly actual = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.criterios(),
  });
  protected readonly version = computed(() => valorDe(this.actual) ?? null);
  private readonly versiones = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.historialCriterios({ limit: 20 }),
  });
  protected readonly historial = computed(() => valorDe(this.versiones)?.data ?? []);

  protected readonly form = this.fb.group({
    rangosEdad: this.fb.array<Fila>([]),
    multiplicadores: this.fb.group(
      Object.fromEntries(GRUPOS.map((g) => [g, this.fb.control('', puntos)])) as Record<
        GrupoObjeto,
        FormControl<string>
      >,
    ),
    puntosInah: ['', puntos],
    distinciones: this.fb.array<Fila>([]),
  });

  constructor() {
    // Carga los criterios vigentes en el formulario cada vez que cambian
    effect(() => {
      const v = this.version();
      if (v) this.cargar(v);
    });
  }

  private fila(a: string, b: string, conNombre = false): Fila {
    return this.fb.group({
      a: [a, puntos],
      b: [b, conNombre ? requerido('Escribe el nombre.') : puntos],
    });
  }

  private cargar(v: VersionCriterios) {
    const { rangosEdad, distinciones } = this.form.controls;
    rangosEdad.clear();
    for (const r of v.rangosEdad)
      rangosEdad.push(this.fila(String(r.desdeAnios), String(r.puntos)));
    distinciones.clear();
    for (const d of v.distinciones) distinciones.push(this.fila(String(d.minimo), d.nombre, true));
    for (const g of GRUPOS)
      this.form.controls.multiplicadores.controls[g].setValue(String(v.multiplicadores[g]));
    this.form.controls.puntosInah.setValue(String(v.puntosInah));
  }

  protected err(c: FormControl<string>) {
    return mensajeError(c);
  }

  protected agregar(lista: FormArray<Fila>, conNombre = false) {
    lista.push(this.fila('', '', conNombre));
  }

  protected quitar(lista: FormArray<Fila>, i: number) {
    lista.removeAt(i);
  }

  protected guardar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const criterios: CriteriosIndice = {
      rangosEdad: v.rangosEdad.map((r) => ({ desdeAnios: Number(r.a), puntos: Number(r.b) })),
      multiplicadores: Object.fromEntries(
        GRUPOS.map((g) => [g, Number(v.multiplicadores[g])]),
      ) as Record<GrupoObjeto, number>,
      puntosInah: Number(v.puntosInah),
      distinciones: v.distinciones.map((d) => ({ minimo: Number(d.a), nombre: d.b.trim() })),
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio.guardarCriterios(criterios).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito('Criterios guardados; el índice se recalculó');
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const error = normalizarError(e);
        const detalle = error.details?.map((d) => d.mensaje).join(' ');
        this.errorGeneral.set(detalle ? `${error.message} ${detalle}` : error.message);
      },
    });
  }
}
