import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo } from '@/app/core/api';
import { opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import {
  errorServidor,
  maximo,
  mensajeError,
  requerido,
  textoONull,
  validarEmail,
  validarUrl,
} from '@/app/core/validadores';
import type { ConfiguracionIglesia } from '@/app/tipos/configuracion';
import { MONEDAS, ZONAS_HORARIAS } from './catalogos';
import { ConfiguracionService } from './configuracion.service';

const CAMPOS_TEXTO = [
  { campo: 'direccion', etiqueta: 'Dirección', tipo: 'text' },
  { campo: 'ciudad', etiqueta: 'Ciudad', tipo: 'text' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
  { campo: 'email', etiqueta: 'Correo de contacto', tipo: 'email' },
  { campo: 'sitioWeb', etiqueta: 'Sitio web', tipo: 'url' },
] as const;

type Campo = 'nombre' | (typeof CAMPOS_TEXTO)[number]['campo'] | 'moneda' | 'zonaHoraria';

/** Pestaña General. Solo ADMIN_IGLESIA edita; los demás roles la ven en modo lectura. */
@Component({
  selector: 'app-form-general',
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="formulario">
      <div class="rejilla">
        <mat-form-field class="doble">
          <mat-label>Nombre de la iglesia</mat-label>
          <input matInput formControlName="nombre" required />
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        @for (c of camposTexto; track c.campo) {
          <mat-form-field>
            <mat-label>{{ c.etiqueta }}</mat-label>
            <input matInput [type]="c.tipo" [formControlName]="c.campo" />
            <mat-error>{{ error(c.campo) }}</mat-error>
          </mat-form-field>
        }
        <mat-form-field>
          <mat-label>Moneda</mat-label>
          <mat-select formControlName="moneda" required>
            @for (o of monedas; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Zona horaria</mat-label>
          <mat-select formControlName="zonaHoraria" required>
            @for (o of zonas; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      @if (editable()) {
        <button
          matButton="filled"
          type="submit"
          class="boton"
          [disabled]="enviando() || form.pristine"
        >
          {{ enviando() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      }
    </form>
  `,
  styles: `
    .formulario {
      display: flex;
      max-width: 48rem;
      flex-direction: column;
      gap: 16px;
    }
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
    .boton {
      align-self: flex-start;
    }
  `,
})
export class FormGeneral {
  readonly config = input.required<ConfiguracionIglesia>();
  readonly editable = input(false);
  private readonly servicio = inject(ConfiguracionService);
  private readonly notificar = inject(NotificarService);

  protected readonly camposTexto = CAMPOS_TEXTO;
  protected readonly monedas = opcionesDe(MONEDAS);
  protected readonly zonas = opcionesDe(ZONAS_HORARIAS);
  protected readonly enviando = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [requerido('Escribe el nombre de la iglesia.'), maximo(150)]],
    direccion: [''],
    ciudad: [''],
    telefono: [''],
    email: ['', validarEmail],
    sitioWeb: ['', validarUrl],
    moneda: [''],
    zonaHoraria: [''],
  });

  constructor() {
    effect(() => {
      const c = this.config();
      this.form.reset({
        nombre: c.nombre,
        direccion: c.direccion ?? '',
        ciudad: c.ciudad ?? '',
        telefono: c.telefono ?? '',
        email: c.email ?? '',
        sitioWeb: c.sitioWeb ?? '',
        moneda: c.moneda,
        zonaHoraria: c.zonaHoraria,
      });
      if (this.editable()) this.form.enable();
      else this.form.disable();
    });
  }

  protected error(campo: Campo) {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.servicio
      .actualizar({
        nombre: v.nombre.trim(),
        direccion: textoONull(v.direccion),
        ciudad: textoONull(v.ciudad),
        telefono: textoONull(v.telefono),
        email: textoONull(v.email)?.toLowerCase() ?? null,
        sitioWeb: textoONull(v.sitioWeb),
        moneda: v.moneda,
        zonaHoraria: v.zonaHoraria,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.form.markAsPristine();
          this.notificar.exito('Configuración guardada');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const campo = (Object.keys(this.form.controls) as Campo[]).find((c) =>
            errorDeCampo(e, c),
          );
          if (campo) errorServidor(this.form.controls[campo], errorDeCampo(e, campo)!);
          else this.notificar.error(e);
        },
      });
  }
}
