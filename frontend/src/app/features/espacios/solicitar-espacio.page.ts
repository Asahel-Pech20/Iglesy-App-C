import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Landmark } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { valorDe } from '@/app/core/recurso';
import {
  errorServidor,
  maximo,
  mensajeError,
  requerido,
  validarEmail,
} from '@/app/core/validadores';
import type { SolicitudCreada } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import { ETIQUETAS_CLASE } from './formato-espacios';
import { MarcoPublico } from './marco-publico';

const TELEFONO = /^[0-9+()\-\s]{7,20}$/;

const validarTelefono: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  return v === '' || TELEFONO.test(v) ? null : { mensaje: 'Teléfono no válido.' };
};

/** Supuesto de P-25: hace falta un teléfono o un correo para que la iglesia pueda responder. */
const contactoMinimo: ValidatorFn = (grupo): ValidationErrors | null => {
  const tel = String(grupo.get('telefono')?.value ?? '').trim();
  const correo = String(grupo.get('correo')?.value ?? '').trim();
  return tel || correo
    ? null
    : { mensaje: 'Deja un teléfono o un correo para que la iglesia pueda responderte.' };
};

const CAMPOS = [
  ['tipoEspacioId', 'tipoEspacioId'],
  ['contacto.nombre', 'nombre'],
  ['contacto.telefono', 'telefono'],
  ['contacto.correo', 'correo'],
  ['comentarios', 'comentarios'],
] as const;

/** /espacios/:iglesiaId — pública: pedir una cripta, nicho, columbario u osario sin crear cuenta. */
@Component({
  selector: 'app-solicitar-espacio',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MarcoPublico,
    EstadoError,
    EstadoVacio,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-marco-publico
      titulo="Solicitar un espacio"
      [subtitulo]="datos()?.iglesia?.nombre ?? 'Criptas, nichos, columbarios y osarios'"
    >
      @if (creada(); as c) {
        <section class="tarjeta tarjeta-cuerpo resultado" aria-labelledby="titulo-resultado">
          <h2 id="titulo-resultado">Solicitud enviada a {{ c.iglesia.nombre }}</h2>
          <p class="alerta alerta-alerta" role="alert">{{ c.aviso }}</p>
          <dl class="datos">
            <div>
              <dt>Folio</dt>
              <dd class="codigo" data-prueba="folio">{{ c.folio }}</dd>
            </div>
            <div>
              <dt>Clave</dt>
              <dd class="codigo" data-prueba="clave">{{ c.clave }}</dd>
            </div>
          </dl>
          <p class="texto-suave">
            Con el folio y la clave puedes ver el estado de tu solicitud, la cotización y responder
            cuando la iglesia te la envíe. No hace falta crear una cuenta.
          </p>
          <div class="acciones">
            <button matButton="outlined" type="button" (click)="copiar(c)">
              Copiar folio y clave
            </button>
            <a
              matButton="filled"
              routerLink="/espacios/seguimiento"
              [queryParams]="{ folio: c.folio }"
            >
              Ver seguimiento
            </a>
          </div>
        </section>
      } @else if (consulta.isLoading() && !consulta.hasValue()) {
        <section class="tarjeta"><app-esqueleto [filas]="4" [columnas]="2" /></section>
      } @else if (consulta.error()) {
        <section class="tarjeta">
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        </section>
      } @else if (tipos().length === 0) {
        <section class="tarjeta">
          <app-estado-vacio
            [icono]="iconoVacio"
            titulo="Esta iglesia no ofrece espacios por ahora"
            descripcion="Vuelve a consultar más adelante o comunícate directamente con la iglesia."
          />
        </section>
      } @else {
        <section class="tarjeta tarjeta-cuerpo">
          <p class="texto-suave">
            Los precios no se publican: cada caso se cotiza aparte. Deja tus datos y la iglesia te
            dirá si hay lugar y cuánto cuesta.
          </p>
          <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
            @if (errorGeneral()) {
              <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
            }
            <mat-form-field>
              <mat-label>Tipo de espacio</mat-label>
              <mat-select formControlName="tipoEspacioId" required>
                @for (t of tipos(); track t.id) {
                  <mat-option [value]="t.id">{{ etiquetas[t.clase] }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ error('tipoEspacioId') }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Tu nombre</mat-label>
              <input matInput autocomplete="name" formControlName="nombre" required />
              <mat-error>{{ error('nombre') }}</mat-error>
            </mat-form-field>
            <div formGroupName="contacto" class="columna">
              <p class="texto-suave pequeno">Deja al menos un teléfono o un correo.</p>
              <mat-form-field>
                <mat-label>Teléfono</mat-label>
                <input matInput type="tel" autocomplete="tel" formControlName="telefono" />
                <mat-error>{{ error('telefono') }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>Correo</mat-label>
                <input matInput type="email" autocomplete="email" formControlName="correo" />
                <mat-error>{{ error('correo') }}</mat-error>
              </mat-form-field>
            </div>
            @if (errorContacto()) {
              <p class="texto-peligro pequeno" role="alert">{{ errorContacto() }}</p>
            }
            <mat-form-field>
              <mat-label>Comentarios</mat-label>
              <textarea matInput rows="3" maxlength="1000" formControlName="comentarios"></textarea>
              <mat-hint>Opcional: para quién es, fechas, dudas.</mat-hint>
              <mat-error>{{ error('comentarios') }}</mat-error>
            </mat-form-field>
            <button matButton="filled" type="submit" [disabled]="enviando()">
              {{ enviando() ? 'Enviando…' : 'Enviar solicitud' }}
            </button>
          </form>
        </section>
        <p class="texto-suave pequeno">
          ¿Ya hiciste una solicitud?
          <a routerLink="/espacios/seguimiento">Consulta su seguimiento</a>.
        </p>
      }
    </app-marco-publico>
  `,
  styles: `
    .columna {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pequeno {
      font-size: 12px;
      margin: 0;
    }
    .datos {
      display: grid;
      gap: 12px;
      margin: 16px 0;
    }
    dt {
      font-size: 12px;
      color: var(--texto-suave);
    }
    dd {
      margin: 0;
    }
    .codigo {
      font-family: ui-monospace, monospace;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class SolicitarEspacioPage {
  /** Parámetro de la ruta (withComponentInputBinding) */
  readonly iglesiaId = input.required<string>();
  private readonly servicio = inject(EspaciosService);

  protected readonly etiquetas = ETIQUETAS_CLASE;
  protected readonly iconoVacio = Landmark;
  protected readonly consulta = rxResource({
    params: () => this.iglesiaId(),
    stream: ({ params }) => this.servicio.tiposPublicos(params),
  });
  protected readonly datos = computed(() => valorDe(this.consulta));
  protected readonly tipos = computed(() => this.datos()?.tipos ?? []);

  protected readonly creada = signal<SolicitudCreada | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly errorContacto = signal<string | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    tipoEspacioId: ['', requerido('Elige el tipo de espacio.')],
    nombre: ['', [requerido('Escribe tu nombre.'), maximo(150)]],
    contacto: this.fb.group(
      {
        telefono: ['', validarTelefono],
        correo: ['', [validarEmail, maximo(150)]],
      },
      { validators: contactoMinimo },
    ),
    comentarios: ['', maximo(1000)],
  });

  protected error(campo: 'tipoEspacioId' | 'nombre' | 'telefono' | 'correo' | 'comentarios') {
    const control =
      campo === 'telefono' || campo === 'correo'
        ? this.form.controls.contacto.controls[campo]
        : this.form.controls[campo];
    return mensajeError(control);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    const contacto = this.form.controls.contacto;
    this.errorContacto.set(contacto.hasError('mensaje') ? mensajeError(contacto) : null);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .crearSolicitud(this.iglesiaId(), {
        tipoEspacioId: v.tipoEspacioId,
        contacto: {
          nombre: v.nombre.trim(),
          ...(v.contacto.telefono.trim() && { telefono: v.contacto.telefono.trim() }),
          ...(v.contacto.correo.trim() && { correo: v.contacto.correo.trim() }),
        },
        ...(v.comentarios.trim() && { comentarios: v.comentarios.trim() }),
      })
      .subscribe({
        next: (c) => {
          this.enviando.set(false);
          this.creada.set(c);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          let conCampo = false;
          for (const [servidor, local] of CAMPOS) {
            const mensaje = errorDeCampo(e, servidor);
            if (!mensaje) continue;
            conCampo = true;
            const control =
              local === 'telefono' || local === 'correo'
                ? contacto.controls[local]
                : this.form.controls[local];
            errorServidor(control, mensaje);
          }
          if (!conCampo) this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }

  protected copiar(c: SolicitudCreada) {
    try {
      void navigator.clipboard?.writeText(`Folio: ${c.folio}\nClave: ${c.clave}`);
    } catch {
      // sin portapapeles: la persona ya ve los datos en pantalla
    }
  }
}
