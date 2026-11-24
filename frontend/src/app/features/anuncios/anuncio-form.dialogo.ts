import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
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
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { format } from 'date-fns';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_PRIORIDAD_ANUNCIO, formatearFechaHora, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { errorServidor, maximo, mensajeError, requerido } from '@/app/core/validadores';
import { EventosService } from '@/app/features/eventos/eventos.service';
import type { Anuncio, GuardarAnuncio, PrioridadAnuncio } from '@/app/tipos/anuncios';
import { AnunciosService } from './anuncios.service';
import { MarkdownSimple } from './markdown-simple';

/** ISO → valor de <input type="datetime-local"> en hora local */
const aLocal = (iso: string | Date) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

const FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const expiracionPosterior: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const publicacion = c.parent?.get('fechaPublicacion')?.value as string | undefined;
  const valor = String(c.value ?? '');
  if (!valor) return null;
  if (!FECHA_LOCAL.test(valor)) return { mensaje: 'Fecha y hora no válidas.' };
  return publicacion && valor <= publicacion
    ? { mensaje: 'La expiración debe ser posterior a la publicación.' }
    : null;
};

const CAMPOS = ['titulo', 'contenido', 'fechaPublicacion', 'fechaExpiracion'] as const;
type Campo = (typeof CAMPOS)[number];

/** Crear / editar anuncio con vista previa del markdown (F3-11). Recibe el anuncio a editar, o nada. */
@Component({
  selector: 'app-anuncio-form-dialogo',
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
    MatTabGroup,
    MatTab,
    MarkdownSimple,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ anuncio ? 'Editar anuncio' : 'Nuevo anuncio' }}</h2>
    <mat-dialog-content>
      <p class="texto-suave">
        Admite markdown simple: **negrita**, *cursiva*, listas con "- " y enlaces.
      </p>
      <form id="form-anuncio" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="rejilla">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro doble" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field class="doble">
          <mat-label>Título</mat-label>
          <input matInput autocomplete="off" maxlength="120" formControlName="titulo" required />
          <mat-error>{{ error('titulo') }}</mat-error>
        </mat-form-field>
        <mat-tab-group class="doble" animationDuration="0ms">
          <mat-tab label="Escribir">
            <mat-form-field class="campo-completo contenido">
              <mat-label>Contenido</mat-label>
              <textarea
                matInput
                rows="6"
                maxlength="5000"
                formControlName="contenido"
                required
              ></textarea>
              <mat-error>{{ error('contenido') }}</mat-error>
            </mat-form-field>
          </mat-tab>
          <mat-tab label="Vista previa">
            <div class="vista-previa" aria-label="Vista previa">
              @if (contenido().trim()) {
                <app-markdown-simple [texto]="contenido()" />
              } @else {
                <p class="texto-suave">Nada que mostrar todavía.</p>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
        <mat-form-field>
          <mat-label>Prioridad</mat-label>
          <mat-select formControlName="prioridad" required>
            @for (o of opcionesPrioridad; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Evento vinculado</mat-label>
          <mat-select formControlName="eventoId">
            <mat-option value="">Sin evento</mat-option>
            @for (o of opcionesEvento(); track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Publicación</mat-label>
          <input matInput type="datetime-local" formControlName="fechaPublicacion" required />
          <mat-hint>Puedes programarlo a futuro.</mat-hint>
          <mat-error>{{ error('fechaPublicacion') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Expiración</mat-label>
          <input matInput type="datetime-local" formControlName="fechaExpiracion" />
          <mat-hint>Opcional.</mat-hint>
          <mat-error>{{ error('fechaExpiracion') }}</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" [disabled]="enviando()" (click)="ref.close(false)">
        Cancelar
      </button>
      <button matButton="filled" type="submit" form="form-anuncio" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : anuncio ? 'Guardar' : 'Publicar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .rejilla {
      display: grid;
      gap: 4px 16px;
    }
    .vista-previa {
      min-height: 8rem;
      margin-top: 12px;
      padding: 12px;
      border: 1px solid var(--marco);
      border-radius: 8px;
      font-size: 14px;
    }
    .contenido {
      margin-top: 12px;
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
export class AnuncioFormDialogo {
  protected readonly anuncio = inject<Anuncio | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly ref = inject(MatDialogRef<AnuncioFormDialogo, boolean>);
  private readonly servicio = inject(AnunciosService);
  private readonly eventosService = inject(EventosService);
  private readonly notificar = inject(NotificarService);

  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly opcionesPrioridad = opcionesDe(ETIQUETAS_PRIORIDAD_ANUNCIO);

  protected readonly form = inject(NonNullableFormBuilder).group({
    titulo: [this.anuncio?.titulo ?? '', [requerido('Escribe el título.'), maximo(120)]],
    contenido: [this.anuncio?.contenido ?? '', [requerido('Escribe el contenido.'), maximo(5000)]],
    prioridad: [(this.anuncio?.prioridad ?? 'NORMAL') as PrioridadAnuncio],
    fechaPublicacion: [
      aLocal(this.anuncio?.fechaPublicacion ?? new Date()),
      requerido('Selecciona la fecha de publicación.'),
    ],
    fechaExpiracion: [
      this.anuncio?.fechaExpiracion ? aLocal(this.anuncio.fechaExpiracion) : '',
      expiracionPosterior,
    ],
    eventoId: [this.anuncio?.evento?.id ?? ''],
  });
  protected readonly contenido = toSignal(this.form.controls.contenido.valueChanges, {
    initialValue: this.form.controls.contenido.value,
  });

  // Evento vinculado: próximos eventos (y el actual, aunque ya haya pasado)
  private readonly proximos = rxResource({ stream: () => this.eventosService.proximos(20) });
  protected readonly opcionesEvento = computed(() => {
    const proximos = valorDe(this.proximos) ?? [];
    const actual = this.anuncio?.evento;
    return [
      ...(actual && !proximos.some((e) => e.id === actual.id)
        ? [{ valor: actual.id, etiqueta: actual.titulo }]
        : []),
      ...proximos.map((e) => ({
        valor: e.id,
        etiqueta: `${e.titulo} (${formatearFechaHora(e.fechaInicio)})`,
      })),
    ];
  });

  constructor() {
    this.form.controls.fechaPublicacion.valueChanges.subscribe(() =>
      this.form.controls.fechaExpiracion.updateValueAndValidity(),
    );
  }

  protected error(campo: Campo) {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const datos: GuardarAnuncio = {
      titulo: v.titulo.trim(),
      contenido: v.contenido.trim(),
      prioridad: v.prioridad,
      fechaPublicacion: new Date(v.fechaPublicacion).toISOString(),
      fechaExpiracion: v.fechaExpiracion ? new Date(v.fechaExpiracion).toISOString() : null,
      eventoId: v.eventoId || null,
    };
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.anuncio
      ? this.servicio.editar(this.anuncio.id, datos)
      : this.servicio.crear(datos);
    peticion.subscribe({
      next: () => {
        this.notificar.exito(this.anuncio ? 'Anuncio guardado' : 'Anuncio publicado');
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
