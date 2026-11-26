import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Landmark, LucideAngularModule } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import type { RespuestaSolicitud, SeguimientoSolicitud } from '@/app/tipos/espacios';
import { EspaciosService } from './espacios.service';
import {
  ETIQUETAS_CLASE,
  ETIQUETAS_ESTADO,
  EXPLICACION_ESTADO,
  fechaHoraLocal,
  varianteEstado,
} from './formato-espacios';
import { TEXTO_ACCION } from './seguimiento-espacio.page';

/**
 * PROPUESTA (2026-11-26, cuenta de cliente; solo frontend y mocks, specs.md §12.3):
 * el cliente ve todas las solicitudes de espacio que hizo con su correo y las responde sin folio ni
 * clave. Las mismas reglas que el seguimiento público: aceptar o rechazar una cotización vigente y
 * cancelar mientras no la acepte.
 */
@Component({
  selector: 'app-mis-solicitudes',
  imports: [
    MatButton,
    RouterLink,
    LucideAngularModule,
    BadgeEstado,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Mis solicitudes"
      descripcion="Tus solicitudes de criptas, nichos, columbarios y osarios, con su cotización."
    >
      <a matButton="filled" routerLink="/templos">Pedir un espacio</a>
    </app-page-header>

    @if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="3" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (solicitudes().length === 0) {
      <app-estado-vacio
        [icono]="iconos.Landmark"
        titulo="Todavía no tienes solicitudes"
        descripcion="Elige una iglesia que ofrezca espacios y pide el tuyo con el correo de tu cuenta."
      />
    } @else {
      <ul class="lista" aria-label="Mis solicitudes">
        @for (s of solicitudes(); track s.folio) {
          <li class="tarjeta tarjeta-cuerpo">
            <div class="cabecera">
              <h2>{{ etiquetas[s.tipo.clase] }} · {{ s.folio }}</h2>
              <app-badge-estado [etiqueta]="estados[s.estado]" [variante]="variante(s.estado)" />
            </div>
            <p>{{ explicacion[s.estado] }}</p>
            <p class="suave">{{ s.iglesia.nombre }} · enviada el {{ hora(s.creadaLocal) }}</p>
            @if (s.cotizacion; as c) {
              <p>
                <span class="monto">{{ moneda.formato(c.monto) }}</span>
                <span class="suave">
                  · {{ c.vigente ? 'vale hasta' : 'venció' }} {{ hora(c.venceLocal) }}</span
                >
              </p>
            }
            @if (s.estado === 'COTIZADA' || s.estado === 'RECIBIDA') {
              <div class="acciones">
                @if (s.estado === 'COTIZADA') {
                  <button matButton="filled" type="button" (click)="responder(s, 'aceptar')">
                    Aceptar cotización
                  </button>
                  <button matButton="outlined" type="button" (click)="responder(s, 'rechazar')">
                    Rechazar cotización
                  </button>
                }
                <button matButton="outlined" type="button" (click)="responder(s, 'cancelar')">
                  Cancelar solicitud
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .lista {
      display: grid;
      gap: 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 400;
      color: var(--primario);
    }
    p {
      margin: 8px 0 0;
    }
    .suave {
      font-size: 13px;
      color: var(--texto-suave);
    }
    .monto {
      font-size: 20px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
  `,
})
export class MisSolicitudesPage {
  private readonly servicio = inject(EspaciosService);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly iconos = { Landmark };
  protected readonly etiquetas = ETIQUETAS_CLASE;
  protected readonly estados = ETIQUETAS_ESTADO;
  protected readonly explicacion = EXPLICACION_ESTADO;
  protected readonly variante = varianteEstado;
  protected readonly hora = fechaHoraLocal;

  protected readonly consulta = rxResource({ stream: () => this.servicio.misSolicitudes() });
  protected readonly solicitudes = computed(() => valorDe(this.consulta)?.data ?? []);

  protected async responder(s: SeguimientoSolicitud, accion: RespuestaSolicitud) {
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
      alConfirmar: () => this.servicio.responderMia(s.folio, accion),
    });
    if (ok) this.notificar.exito(texto.exito);
    // Se vuelve a pedir la lista: refleja el estado guardado (también si la cotización venció)
    this.consulta.reload();
  }
}
