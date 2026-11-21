import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { CalendarClock, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import { errorDeCampo } from '@/app/core/api';
import { valorDe } from '@/app/core/recurso';
import { DIAS_SEMANA } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { errorServidor, maximo, mensajeError, requerido, textoONull } from '@/app/core/validadores';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import type { HorarioReunion } from '@/app/tipos/configuracion';
import { ConfiguracionService } from './configuracion.service';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarHora(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '');
  return v === '' || HORA.test(v) ? null : { mensaje: 'Formato HH:mm.' };
}

/** Crea o edita un horario. Se cierra con `true` si guardó. */
@Component({
  selector: 'app-horario-form-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ horario ? 'Editar horario' : 'Nuevo horario' }}</h2>
    <mat-dialog-content>
      <p class="texto-suave">Reunión habitual que se muestra en la cartelera pública.</p>
      <form id="form-horario" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="rejilla">
        <mat-form-field class="doble">
          <mat-label>Nombre</mat-label>
          <input matInput placeholder="Culto dominical" formControlName="nombre" required />
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        <mat-form-field class="doble">
          <mat-label>Día</mat-label>
          <mat-select formControlName="diaSemana" required>
            @for (dia of dias; track $index) {
              <mat-option [value]="$index">{{ dia }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Hora de inicio</mat-label>
          <input matInput type="time" formControlName="horaInicio" required />
          <mat-error>{{ error('horaInicio') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Hora de fin</mat-label>
          <input matInput type="time" formControlName="horaFin" />
          <mat-error>{{ error('horaFin') }}</mat-error>
        </mat-form-field>
        <mat-form-field class="doble">
          <mat-label>Lugar</mat-label>
          <input matInput placeholder="Templo principal" formControlName="lugar" />
        </mat-form-field>
        <mat-slide-toggle class="doble" formControlName="activo">Activo</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-horario" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .rejilla {
      display: grid;
      gap: 4px 16px;
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
export class HorarioFormDialogo {
  protected readonly horario = inject<HorarioReunion | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly ref = inject(MatDialogRef<HorarioFormDialogo, boolean>);
  private readonly servicio = inject(ConfiguracionService);
  private readonly notificar = inject(NotificarService);
  protected readonly dias = DIAS_SEMANA;
  protected readonly enviando = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      nombre: [
        this.horario?.nombre ?? '',
        [requerido('Escribe el nombre de la reunión.'), maximo(100)],
      ],
      diaSemana: [this.horario?.diaSemana ?? 0],
      horaInicio: [this.horario?.horaInicio ?? '', [requerido('Escribe la hora.'), validarHora]],
      horaFin: [this.horario?.horaFin ?? '', validarHora],
      lugar: [this.horario?.lugar ?? ''],
      activo: [this.horario?.activo ?? true],
    },
    {
      validators: (g) => {
        const fin = g.get('horaFin');
        const inicio = String(g.get('horaInicio')?.value ?? '');
        const v = String(fin?.value ?? '');
        if (fin && v && inicio && v <= inicio && !fin.hasError('mensaje')) {
          fin.setErrors({ mensaje: 'La hora de fin debe ser posterior a la de inicio.' });
        }
        return null;
      },
    },
  );

  protected error(campo: 'nombre' | 'horaInicio' | 'horaFin') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.servicio
      .guardarHorario(
        {
          nombre: v.nombre.trim(),
          diaSemana: v.diaSemana,
          horaInicio: v.horaInicio,
          horaFin: v.horaFin || null,
          lugar: textoONull(v.lugar),
          activo: v.activo,
        },
        this.horario?.id,
      )
      .subscribe({
        next: () => {
          this.notificar.exito(this.horario ? 'Horario actualizado' : 'Horario agregado');
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const mensaje = errorDeCampo(e, 'horaFin');
          if (mensaje) errorServidor(this.form.controls.horaFin, mensaje);
          else this.notificar.error(e);
        },
      });
  }
}

/** Pestaña Horarios: lista agrupada por día; solo ADMIN_IGLESIA agrega, edita y elimina. */
@Component({
  selector: 'app-horarios',
  imports: [
    MatButton,
    MatIconButton,
    LucideAngularModule,
    BadgeEstado,
    EstadoVacio,
    EstadoError,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columna ancho">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="3" [columnas]="3" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (porDia().length === 0) {
        <section class="tarjeta">
          <app-estado-vacio
            [icono]="iconos.CalendarClock"
            titulo="Sin horarios registrados"
            descripcion="Agrega las reuniones habituales de la iglesia."
          >
            @if (editable()) {
              <button matButton="filled" type="button" (click)="abrir()">
                <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Agregar horario
              </button>
            }
          </app-estado-vacio>
        </section>
      } @else {
        @if (editable()) {
          <div>
            <button matButton="filled" type="button" (click)="abrir()">
              <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Agregar horario
            </button>
          </div>
        }
        @for (grupo of porDia(); track grupo.dia) {
          <section [attr.aria-label]="grupo.dia">
            <h3 class="dia texto-suave">{{ grupo.dia }}</h3>
            <ul class="tarjeta lista">
              @for (h of grupo.horarios; track h.id) {
                <li>
                  <div class="datos">
                    <p class="nombre">{{ h.nombre }}</p>
                    <p class="texto-suave">
                      {{ h.horaInicio }}{{ h.horaFin ? ' – ' + h.horaFin : ''
                      }}{{ h.lugar ? ' · ' + h.lugar : '' }}
                    </p>
                  </div>
                  @if (!h.activo) {
                    <app-badge-estado [activo]="false" />
                  }
                  @if (editable()) {
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="'Editar ' + h.nombre"
                      (click)="abrir(h)"
                    >
                      <lucide-icon [img]="iconos.Pencil" [size]="16" aria-hidden="true" />
                    </button>
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="'Eliminar ' + h.nombre"
                      (click)="eliminar(h)"
                    >
                      <lucide-icon
                        [img]="iconos.Trash2"
                        [size]="16"
                        class="texto-peligro"
                        aria-hidden="true"
                      />
                    </button>
                  }
                </li>
              }
            </ul>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .ancho {
      max-width: 48rem;
    }
    .dia {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
    }
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lista li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px;
    }
    .lista li + li {
      border-top: 1px solid var(--borde);
    }
    .datos {
      min-width: 0;
      flex: 1;
    }
    .datos p {
      margin: 0;
    }
    .nombre {
      font-weight: 500;
    }
  `,
})
export class Horarios {
  readonly editable = input(false);
  private readonly servicio = inject(ConfiguracionService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);

  protected readonly consulta = rxResource({ stream: () => this.servicio.listarHorarios() });
  protected readonly porDia = computed(() => {
    const horarios = valorDe(this.consulta) ?? [];
    return DIAS_SEMANA.map((dia, i) => ({
      dia,
      horarios: horarios.filter((h) => h.diaSemana === i),
    })).filter((g) => g.horarios.length > 0);
  });
  protected readonly iconos = { CalendarClock, Plus, Pencil, Trash2 };

  protected abrir(horario?: HorarioReunion) {
    this.dialog
      .open(HorarioFormDialogo, {
        data: horario ?? null,
        width: '32rem',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((guardado) => guardado && this.consulta.reload());
  }

  protected async eliminar(horario: HorarioReunion) {
    const hecho = await this.confirmar.abrir({
      titulo: 'Eliminar horario',
      descripcion: `Se eliminará "${horario.nombre}". Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
      alConfirmar: () => this.servicio.eliminarHorario(horario.id),
    });
    if (hecho) {
      this.notificar.exito('Horario eliminado');
      this.consulta.reload();
    }
  }
}
