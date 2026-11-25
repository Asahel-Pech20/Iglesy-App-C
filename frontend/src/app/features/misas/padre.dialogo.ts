import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
import { of } from 'rxjs';
import { normalizarError } from '@/app/core/api';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido, textoONull } from '@/app/core/validadores';
import type { PadreNacional } from '@/app/tipos/misas';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

/**
 * Agrega un padre a la iglesia (RF-40, RF-41). Primero busca si ya existe en el país (un padre
 * celebra en varias iglesias) para asociarlo; si no está, lo registra (supuesto P-19).
 */
@Component({
  selector: 'app-padre-dialogo',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Agregar padre</h2>
    <mat-dialog-content>
      @if (errorGeneral()) {
        <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
      }
      <mat-form-field class="completo">
        <mat-label>Buscar un padre que ya existe</mat-label>
        <input
          matInput
          autocomplete="off"
          maxlength="120"
          #q
          [value]="busqueda()"
          (input)="busqueda.set(q.value)"
        />
        <mat-hint
          >Si ya celebra en otra iglesia, asócialo en lugar de registrarlo otra vez.</mat-hint
        >
      </mat-form-field>
      @if (busqueda().trim().length >= 2) {
        <ul class="resultados" aria-label="Padres encontrados">
          @for (p of encontrados(); track p.id) {
            <li>
              <span>
                <strong>{{ nombre(p) }}</strong>
                @if (p.iglesias.length > 0) {
                  <span class="texto-suave"> · {{ iglesiasDe(p) }}</span>
                }
              </span>
              <button
                matButton="tonal"
                type="button"
                [disabled]="asociando() === p.id"
                (click)="asociar(p)"
              >
                Asociar
              </button>
            </li>
          } @empty {
            <li class="texto-suave">No hay padres con ese nombre.</li>
          }
        </ul>
      }

      <h3>¿No está? Regístralo</h3>
      <form id="form-padre" [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <div class="fila">
          <mat-form-field class="titulo">
            <mat-label>Título</mat-label>
            <input matInput formControlName="titulo" maxlength="30" placeholder="Pbro." />
          </mat-form-field>
          <mat-form-field class="nombre">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="nombre" maxlength="120" required />
            <mat-error>{{ error() }}</mat-error>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cerrar</button>
      <button matButton="filled" type="submit" form="form-padre" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Registrar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .completo {
      width: 100%;
    }
    .fila {
      display: flex;
      gap: 12px;
    }
    .titulo {
      width: 7rem;
    }
    .nombre {
      flex: 1;
    }
    h3 {
      margin: 16px 0 8px;
      font-size: 14px;
      font-weight: 500;
    }
    .resultados {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }
    .resultados li {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }
  `,
})
export class PadreDialogo {
  protected readonly ref = inject(MatDialogRef<PadreDialogo, boolean>);
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly nombre = nombrePadre;
  protected readonly busqueda = signal('');
  protected readonly asociando = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly resultados = rxResource({
    params: () => this.busqueda().trim(),
    stream: ({ params: q }) =>
      q.length >= 2 ? this.servicio.buscarPadres(q) : of({ data: [] as PadreNacional[] }),
  });
  protected readonly encontrados = computed(
    () => valorDe(this.resultados)?.data.filter((p) => p.activo) ?? [],
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    titulo: [''],
    nombre: ['', [requerido('Escribe el nombre.'), Validators.maxLength(120)]],
  });

  protected error() {
    return mensajeError(this.form.controls.nombre);
  }

  protected iglesiasDe(p: PadreNacional) {
    return p.iglesias.map((i) => i.nombre).join(', ');
  }

  protected asociar(p: PadreNacional) {
    this.errorGeneral.set(null);
    this.asociando.set(p.id);
    this.servicio.asociarPadre(p.id).subscribe({
      next: () => {
        this.asociando.set(null);
        this.notificar.exito(`${nombrePadre(p)} asociado a tu iglesia`);
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.asociando.set(null);
        this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }

  protected registrar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio.crearPadre({ nombre: v.nombre.trim(), titulo: textoONull(v.titulo) }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notificar.exito('Padre registrado');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        // 409: ya existe con ese nombre; se sugiere buscarlo y asociarlo
        this.errorGeneral.set(normalizarError(e).message);
        this.busqueda.set(v.nombre.trim());
      },
    });
  }
}
