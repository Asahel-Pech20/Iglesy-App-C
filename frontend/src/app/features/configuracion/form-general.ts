import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo } from '@/app/core/api';
import { opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { SesionService } from '@/app/core/sesion.service';
import { errorServidor, mensajeError, textoONull, validarUrl } from '@/app/core/validadores';
import type { ConfiguracionIglesia } from '@/app/tipos/configuracion';
import { MONEDAS, ZONAS_HORARIAS } from './catalogos';
import { ConfiguracionService } from './configuracion.service';

/**
 * E1-06b: datos de la FICHA de la iglesia. Aquí solo se muestran; se editan en la ficha
 * (PATCH /iglesias/:id, módulo de Nataly) con sus reglas (nombre único por municipio, INEGI).
 */
const DATOS_FICHA = [
  { campo: 'nombre', etiqueta: 'Nombre de la iglesia' },
  { campo: 'direccion', etiqueta: 'Dirección' },
  { campo: 'ciudad', etiqueta: 'Ciudad (municipio)' },
  { campo: 'telefono', etiqueta: 'Teléfono' },
  { campo: 'email', etiqueta: 'Correo de contacto' },
] as const;

type Campo = 'sitioWeb' | 'moneda' | 'zonaHoraria';

/**
 * Pestaña General. Solo ADMIN_IGLESIA edita lo institucional (moneda, zona horaria y sitio web);
 * los demás roles la ven en modo lectura. Nombre, dirección y contacto vienen de la ficha.
 */
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
      <section class="ficha" aria-labelledby="titulo-ficha">
        <h3 id="titulo-ficha">Datos de la ficha</h3>
        <dl class="rejilla">
          @for (d of datosFicha; track d.campo) {
            <div>
              <dt class="texto-suave">{{ d.etiqueta }}</dt>
              <dd>{{ config()[d.campo] || '—' }}</dd>
            </div>
          }
        </dl>
        <p class="texto-suave nota">
          Se editan en la ficha de la iglesia.
          @if (iglesiaId(); as id) {
            <a [href]="'/templos/' + id">Ver la ficha</a>
          }
        </p>
      </section>
      <div class="rejilla">
        <mat-form-field class="doble">
          <mat-label>Sitio web</mat-label>
          <input matInput type="url" formControlName="sitioWeb" />
          <mat-error>{{ error('sitioWeb') }}</mat-error>
        </mat-form-field>
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
    .ficha h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    dl {
      margin: 0;
    }
    dt {
      font-size: 12px;
    }
    dd {
      margin: 0 0 8px;
      overflow-wrap: anywhere;
    }
    .nota {
      margin: 0;
      font-size: 14px;
    }
  `,
})
export class FormGeneral {
  readonly config = input.required<ConfiguracionIglesia>();
  readonly editable = input(false);
  private readonly servicio = inject(ConfiguracionService);
  private readonly notificar = inject(NotificarService);

  private readonly sesion = inject(SesionService);

  protected readonly datosFicha = DATOS_FICHA;
  /** Iglesia del usuario, para el enlace a su ficha pública */
  protected readonly iglesiaId = computed(() => this.sesion.iglesia()?.id ?? null);
  protected readonly monedas = opcionesDe(MONEDAS);
  protected readonly zonas = opcionesDe(ZONAS_HORARIAS);
  protected readonly enviando = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    sitioWeb: ['', validarUrl],
    moneda: [''],
    zonaHoraria: [''],
  });

  constructor() {
    effect(() => {
      const c = this.config();
      this.form.reset({
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
