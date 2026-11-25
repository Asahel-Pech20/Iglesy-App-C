import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
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
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { NotificarService } from '@/app/core/notificar.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { errorServidor, maximo, mensajeError, requerido } from '@/app/core/validadores';
import type { SolicitudEspacio } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import {
  ETIQUETAS_CLASE,
  ETIQUETAS_ESTADO,
  fechaHoraLocal,
  varianteEstado,
} from './formato-espacios';

/** Mismo formato de dinero que el backend: hasta 10 enteros y 2 decimales, mayor que cero. */
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;
const validarMonto: ValidatorFn = (c) => {
  const v = String(c.value ?? '').trim();
  if (v === '') return { mensaje: 'Escribe el monto.' };
  if (!FORMATO_MONTO.test(v)) return { mensaje: 'Monto no válido (hasta 2 decimales).' };
  return Number(v) > 0 ? null : { mensaje: 'El monto debe ser mayor que cero.' };
};

/** Detalle de una solicitud: contacto, cotización y, si está «Recibida», cotizar o avisar que no hay lugar. */
@Component({
  selector: 'app-solicitud-espacio-dialogo',
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
    BadgeEstado,
    EstadoError,
    Esqueleto,
    PuedeDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Solicitud {{ inicial.folio }}</h2>
    <mat-dialog-content>
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="4" [columnas]="2" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (s(); as s) {
        <div class="cabecera">
          <strong>{{ clases[s.tipo.clase] }}</strong>
          <app-badge-estado [etiqueta]="estados[s.estado]" [variante]="variante(s.estado)" />
        </div>
        <p class="texto-suave pequeno">Recibida el {{ hora(s.creadaLocal) }}</p>

        <h3>Contacto</h3>
        <p class="datos">
          {{ s.contacto.nombre }}
          @if (s.contacto.telefono) {
            · Tel. {{ s.contacto.telefono }}
          }
          @if (s.contacto.correo) {
            · {{ s.contacto.correo }}
          }
        </p>
        @if (s.comentarios) {
          <p class="texto-suave">«{{ s.comentarios }}»</p>
        }

        @if (s.cotizacion; as c) {
          <h3>Cotización</h3>
          <p class="monto" data-prueba="monto">{{ moneda.formato(c.monto) }}</p>
          <p>{{ c.condiciones }}</p>
          <p class="texto-suave pequeno">
            Emitida el {{ hora(c.emitidaLocal) }} · {{ c.vigente ? 'vale hasta' : 'venció' }} el
            {{ hora(c.venceLocal) }}
          </p>
        }

        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }

        @if (s.estado === 'RECIBIDA') {
          <ng-container *appPuede="'espacios:gestionar'">
            <h3>Responder a la persona</h3>
            <form
              id="form-cotizacion"
              [formGroup]="form"
              (ngSubmit)="cotizar()"
              novalidate
              class="columna"
            >
              <mat-form-field>
                <mat-label>Monto</mat-label>
                <input
                  matInput
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="0.00"
                  formControlName="monto"
                />
                <mat-hint>Cuánto cuesta exclusivamente este servicio.</mat-hint>
                <mat-error>{{ error('monto') }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>Condiciones</mat-label>
                <textarea
                  matInput
                  rows="3"
                  maxlength="2000"
                  formControlName="condiciones"
                ></textarea>
                <mat-hint>La cotización vale 15 días desde que la envías.</mat-hint>
                <mat-error>{{ error('condiciones') }}</mat-error>
              </mat-form-field>
            </form>
          </ng-container>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close()">Cerrar</button>
      @if (s()?.estado === 'RECIBIDA') {
        <ng-container *appPuede="'espacios:gestionar'">
          <button matButton="outlined" type="button" [disabled]="enviando()" (click)="sinLugar()">
            No hay lugar
          </button>
          <button matButton="filled" type="submit" form="form-cotizacion" [disabled]="enviando()">
            {{ enviando() ? 'Enviando…' : 'Enviar cotización' }}
          </button>
        </ng-container>
      }
    </mat-dialog-actions>
  `,
  styles: `
    h3 {
      margin: 16px 0 4px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 15px;
      font-weight: 400;
      color: var(--primario);
    }
    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .pequeno {
      font-size: 12px;
      margin: 0;
    }
    .datos {
      margin: 0;
    }
    .monto {
      margin: 0;
      font-size: 24px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    .columna {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `,
})
export class SolicitudEspacioDialogo {
  protected readonly inicial = inject<SolicitudEspacio>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<SolicitudEspacioDialogo>);
  private readonly servicio = inject(EspaciosService);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly clases = ETIQUETAS_CLASE;
  protected readonly estados = ETIQUETAS_ESTADO;
  protected readonly variante = varianteEstado;
  protected readonly hora = fechaHoraLocal;

  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  // La lista trae un resumen; el detalle se vuelve a pedir para ver el estado actual
  protected readonly consulta = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.obtenerSolicitud(this.inicial.id),
  });
  protected readonly s = computed(() => valorDe(this.consulta) ?? null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    monto: ['', validarMonto],
    condiciones: ['', [requerido('Escribe las condiciones de la cotización.'), maximo(2000)]],
  });

  protected error(campo: 'monto' | 'condiciones') {
    return mensajeError(this.form.controls[campo]);
  }

  protected cotizar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { monto, condiciones } = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .cotizar(this.inicial.id, { monto: monto.trim(), condiciones: condiciones.trim() })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.notificar.exito('Cotización enviada');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          let conCampo = false;
          for (const campo of ['monto', 'condiciones'] as const) {
            const mensaje = errorDeCampo(e, campo);
            if (mensaje) {
              errorServidor(this.form.controls[campo], mensaje);
              conCampo = true;
            }
          }
          if (!conCampo) this.errorGeneral.set(normalizarError(e).message);
          // Si otra persona la atendió mientras tanto, se muestra su estado actual
          this.consulta.reload();
        },
      });
  }

  protected async sinLugar() {
    const ok = await this.confirmar.abrir({
      titulo: 'Avisar que no hay lugar',
      descripcion:
        'La persona verá que no hay lugar de este tipo y ya no podrás cotizar esta solicitud.',
      textoConfirmar: 'No hay lugar',
      peligro: true,
      alConfirmar: () => this.servicio.marcarSinLugar(this.inicial.id),
    });
    if (ok) this.notificar.exito('Solicitud marcada sin lugar');
  }
}
