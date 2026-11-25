import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { normalizarError } from '@/app/core/api';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { NotificarService } from '@/app/core/notificar.service';
import { mensajeError, requerido } from '@/app/core/validadores';
import type { RespuestaSolicitud, SeguimientoSolicitud } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import {
  ETIQUETAS_CLASE,
  ETIQUETAS_ESTADO,
  EXPLICACION_ESTADO,
  fechaHoraLocal,
  varianteEstado,
} from './formato-espacios';
import { MarcoPublico } from './marco-publico';

const TEXTO_ACCION: Record<RespuestaSolicitud, { titulo: string; exito: string; boton: string }> = {
  aceptar: { titulo: 'Aceptar la cotización', exito: 'Cotización aceptada', boton: 'Aceptar' },
  rechazar: { titulo: 'Rechazar la cotización', exito: 'Cotización rechazada', boton: 'Rechazar' },
  cancelar: {
    titulo: 'Cancelar la solicitud',
    exito: 'Solicitud cancelada',
    boton: 'Cancelar solicitud',
  },
};

/** /espacios/seguimiento — pública: estado, cotización y respuesta con folio y clave. */
@Component({
  selector: 'app-seguimiento-espacio',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    BadgeEstado,
    MarcoPublico,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-marco-publico
      titulo="Seguimiento de tu solicitud"
      subtitulo="Consulta con tu folio y tu clave. No hace falta una cuenta."
    >
      <section class="tarjeta tarjeta-cuerpo">
        <form [formGroup]="form" (ngSubmit)="consultar()" novalidate class="columna">
          @if (error()) {
            <p class="alerta alerta-peligro" role="alert">{{ error() }}</p>
          }
          <mat-form-field>
            <mat-label>Folio</mat-label>
            <input
              matInput
              autocomplete="off"
              formControlName="folio"
              placeholder="ESP-2026-000123"
              required
            />
            <mat-error>{{ mensaje('folio') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Clave</mat-label>
            <input
              matInput
              autocomplete="off"
              formControlName="clave"
              placeholder="ABCDE-FGHJK"
              required
            />
            <mat-hint>La que recibiste al enviar tu solicitud.</mat-hint>
            <mat-error>{{ mensaje('clave') }}</mat-error>
          </mat-form-field>
          <button matButton="filled" type="submit" [disabled]="cargando()">
            {{ cargando() ? 'Consultando…' : 'Consultar' }}
          </button>
        </form>
      </section>

      @if (seguimiento(); as s) {
        <section class="tarjeta tarjeta-cuerpo" aria-labelledby="titulo-seguimiento">
          <div class="cabecera">
            <h2 id="titulo-seguimiento">{{ etiquetas[s.tipo.clase] }} · {{ s.folio }}</h2>
            <app-badge-estado [etiqueta]="estados[s.estado]" [variante]="variante(s.estado)" />
          </div>
          <p>{{ explicacion[s.estado] }}</p>
          <p class="texto-suave pequeno">Solicitud enviada el {{ fecha(s) }}.</p>

          <h3>Con quién se hace</h3>
          <p>
            <strong>{{ s.iglesia.nombre }}</strong>
            @if (s.iglesia.telefono) {
              · Tel. {{ s.iglesia.telefono }}
            }
            @if (s.iglesia.correo) {
              · {{ s.iglesia.correo }}
            }
          </p>

          @if (s.cotizacion; as c) {
            <h3>Cotización</h3>
            <dl class="datos">
              <div>
                <dt>Cuánto cuesta</dt>
                <dd class="monto" data-prueba="monto">{{ moneda.formato(c.monto) }}</dd>
              </div>
              <div>
                <dt>Condiciones</dt>
                <dd>{{ c.condiciones }}</dd>
              </div>
              <div>
                <dt>Emitida</dt>
                <dd>{{ hora(c.emitidaLocal) }}</dd>
              </div>
              <div>
                <dt>{{ c.vigente ? 'Vale hasta' : 'Venció' }}</dt>
                <dd>{{ hora(c.venceLocal) }}</dd>
              </div>
            </dl>
          }

          @if (puedeResponder(s) || puedeCancelar(s)) {
            <div class="acciones">
              @if (puedeResponder(s)) {
                <button matButton="filled" type="button" (click)="responder(s, 'aceptar')">
                  Aceptar cotización
                </button>
                <button matButton="outlined" type="button" (click)="responder(s, 'rechazar')">
                  Rechazar cotización
                </button>
              }
              @if (puedeCancelar(s)) {
                <button matButton="outlined" type="button" (click)="responder(s, 'cancelar')">
                  Cancelar solicitud
                </button>
              }
            </div>
          }
        </section>
      }

      <p class="texto-suave pequeno">
        ¿Todavía no tienes una solicitud? Pídela desde la página de la iglesia o con el enlace que
        te compartieron. <a routerLink="/cartelera">Ver la cartelera</a>.
      </p>
    </app-marco-publico>
  `,
  styles: `
    .columna {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h2,
    h3 {
      margin: 0 0 8px;
    }
    h3 {
      margin-top: 16px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px;
      font-weight: 400;
      color: var(--primario);
    }
    .pequeno {
      font-size: 12px;
    }
    .datos {
      display: grid;
      gap: 12px;
      margin: 0;
    }
    dt {
      font-size: 12px;
      color: var(--texto-suave);
    }
    dd {
      margin: 0;
    }
    .monto {
      font-size: 24px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class SeguimientoEspacioPage {
  /** ?folio= (withComponentInputBinding): lo trae el enlace de «Ver seguimiento» */
  readonly folioParam = input<string | undefined>(undefined, { alias: 'folio' });
  private readonly servicio = inject(EspaciosService);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly etiquetas = ETIQUETAS_CLASE;
  protected readonly estados = ETIQUETAS_ESTADO;
  protected readonly explicacion = EXPLICACION_ESTADO;
  protected readonly variante = varianteEstado;
  protected readonly hora = fechaHoraLocal;

  protected readonly seguimiento = signal<SeguimientoSolicitud | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    folio: ['', requerido('Escribe tu folio.')],
    clave: ['', requerido('Escribe tu clave.')],
  });

  constructor() {
    // El folio del enlace se escribe solo; la clave nunca viaja en la URL
    queueMicrotask(() => {
      const folio = this.folioParam();
      if (folio) this.form.controls.folio.setValue(folio);
    });
  }

  protected mensaje(campo: 'folio' | 'clave') {
    return mensajeError(this.form.controls[campo]);
  }

  protected fecha(s: SeguimientoSolicitud) {
    return fechaHoraLocal(s.creadaLocal);
  }

  protected puedeResponder(s: SeguimientoSolicitud) {
    return s.estado === 'COTIZADA';
  }

  protected puedeCancelar(s: SeguimientoSolicitud) {
    return s.estado === 'RECIBIDA' || s.estado === 'COTIZADA';
  }

  protected consultar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { folio, clave } = this.form.getRawValue();
    this.error.set(null);
    this.cargando.set(true);
    this.servicio.consultar(folio.trim(), clave.trim()).subscribe({
      next: (s) => {
        this.cargando.set(false);
        this.seguimiento.set(s);
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        this.seguimiento.set(null);
        this.error.set(normalizarError(e).message);
      },
    });
  }

  protected async responder(s: SeguimientoSolicitud, accion: RespuestaSolicitud) {
    const { folio, clave } = this.form.getRawValue();
    const texto = TEXTO_ACCION[accion];
    const detalle =
      accion === 'aceptar' && s.cotizacion
        ? `Aceptas ${this.moneda.formato(s.cotizacion.monto)}. Una solicitud aceptada ya no se puede cancelar.`
        : accion === 'rechazar'
          ? 'Ya no podrás aceptar esta cotización.'
          : 'Tu solicitud quedará cancelada y conservará su historial.';
    const ok = await this.confirmar.abrir({
      titulo: texto.titulo,
      descripcion: detalle,
      textoConfirmar: texto.boton,
      peligro: accion !== 'aceptar',
      alConfirmar: () => this.servicio.responder(folio.trim(), clave.trim(), accion),
    });
    if (ok) {
      this.notificar.exito(texto.exito);
      // Se vuelve a consultar para mostrar el estado final tal como lo guardó el servidor
      this.consultar();
    } else {
      // Si la cotización venció mientras tanto, el servidor ya guardó ese estado: se refleja
      this.refrescarEnSilencio();
    }
  }

  private refrescarEnSilencio() {
    const { folio, clave } = this.form.getRawValue();
    this.servicio.consultar(folio.trim(), clave.trim()).subscribe({
      next: (s) => this.seguimiento.set(s),
      error: () => undefined,
    });
  }
}
