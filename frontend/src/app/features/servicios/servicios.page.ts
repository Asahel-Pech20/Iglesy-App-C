import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTab, MatTabContent, MatTabGroup } from '@angular/material/tabs';
import { BookOpen, LucideAngularModule } from 'lucide-angular';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { filtrosURL } from '@/app/core/filtros-url';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import {
  describirCosto,
  describirDuracion,
  describirHorarios,
  ETIQUETAS_TIPO_PLATICA,
} from '@/app/features/misas/formato-misas';
import type { Platica, Servicio } from '@/app/tipos/servicios';
import { PlaticaDialogo } from './platica.dialogo';
import { ServicioDialogo } from './servicio.dialogo';
import { ServiciosService } from './servicios.service';

const PESTANAS = ['servicios', 'platicas'] as const;

/**
 * /servicios — servicios (bautizo, primera comunión, confirmación, casamiento…) y pláticas de
 * preparación de la iglesia (E3-17: RF-30–RF-37). El público los ve en la ficha de la iglesia.
 */
@Component({
  selector: 'app-servicios',
  imports: [
    MatButton,
    MatTabGroup,
    MatTab,
    MatTabContent,
    LucideAngularModule,
    PageHeader,
    EstadoError,
    EstadoVacio,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Servicios y pláticas"
      descripcion="Lo que ofrece tu iglesia: costos, requisitos, horarios y pláticas de preparación."
    />
    <mat-tab-group
      animationDuration="0ms"
      [selectedIndex]="indice()"
      (selectedIndexChange)="cambiarPestana($event)"
    >
      <mat-tab label="Servicios">
        <ng-template matTabContent>
          <section class="tarjeta pestana">
            <div class="encabezado">
              <p class="texto-suave">
                Cada iglesia fija sus costos; algunos son gratuitos o con donativo.
              </p>
              <button matButton="filled" type="button" (click)="editarServicio(null)">
                Nuevo servicio
              </button>
            </div>
            @if (servicios.isLoading() && !servicios.hasValue()) {
              <app-esqueleto [filas]="4" [columnas]="5" />
            } @else if (servicios.error()) {
              <app-estado-error [error]="servicios.error()" (reintentar)="servicios.reload()" />
            } @else if (listaServicios().length === 0) {
              <app-estado-vacio
                [icono]="iconoVacio"
                titulo="Aún no hay servicios"
                descripcion="Registra bautizo, primera comunión, confirmación, casamiento y otros."
              />
            } @else {
              <div class="contenedor-tabla">
                <table class="tabla-simple" aria-label="Servicios de la iglesia">
                  <thead>
                    <tr>
                      <th scope="col">Servicio</th>
                      <th scope="col">Costo</th>
                      <th scope="col">Duración</th>
                      <th scope="col">Días y horarios</th>
                      <th scope="col"><span class="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (s of listaServicios(); track s.id) {
                      <tr>
                        <td>
                          <span class="fuerte">{{ s.nombre }}</span>
                          @if (s.requisitos) {
                            <span class="detalle texto-suave">{{ s.requisitos }}</span>
                          }
                        </td>
                        <td>{{ costo(s) }}</td>
                        <td>{{ duracion(s.duracionMin) }}</td>
                        <td>
                          {{ horarios(s.horarios) || (s.requiereCita ? 'Con cita' : '—') }}
                          @if (s.requiereCita && s.horarios.length > 0) {
                            <span class="detalle texto-suave">Requiere cita</span>
                          }
                        </td>
                        <td class="acciones">
                          <button matButton type="button" (click)="editarServicio(s)">
                            Modificar
                          </button>
                          <button
                            matButton
                            type="button"
                            class="peligro"
                            [attr.aria-label]="'Quitar el servicio ' + s.nombre"
                            (click)="quitarServicio(s)"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </ng-template>
      </mat-tab>
      <mat-tab label="Pláticas">
        <ng-template matTabContent>
          <section class="tarjeta pestana">
            <div class="encabezado">
              <p class="texto-suave">
                Prebautismales, catecismo de primera comunión, confirmación y prematrimoniales.
              </p>
              <button matButton="filled" type="button" (click)="editarPlatica(null)">
                Nueva plática
              </button>
            </div>
            @if (platicas.isLoading() && !platicas.hasValue()) {
              <app-esqueleto [filas]="4" [columnas]="5" />
            } @else if (platicas.error()) {
              <app-estado-error [error]="platicas.error()" (reintentar)="platicas.reload()" />
            } @else if (listaPlaticas().length === 0) {
              <app-estado-vacio
                [icono]="iconoVacio"
                titulo="Aún no hay pláticas"
                descripcion="Registra al menos dos tipos de plática con sus días y hora."
              />
            } @else {
              <div class="contenedor-tabla">
                <table class="tabla-simple" aria-label="Pláticas de la iglesia">
                  <thead>
                    <tr>
                      <th scope="col">Plática</th>
                      <th scope="col">Días y hora</th>
                      <th scope="col">Sesiones</th>
                      <th scope="col">Costo</th>
                      <th scope="col">Cupo</th>
                      <th scope="col"><span class="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of listaPlaticas(); track p.id) {
                      <tr>
                        <td>
                          <span class="fuerte">{{ tiposPlatica[p.tipo] }}</span>
                          <span class="detalle texto-suave">{{ p.lugar }} · {{ p.imparte }}</span>
                        </td>
                        <td>{{ horarios(p.horarios) }}</td>
                        <td class="num">{{ p.sesiones }}</td>
                        <td>{{ costoPlatica(p) }}</td>
                        <td class="num">{{ p.cupo }}</td>
                        <td class="acciones">
                          <button matButton type="button" (click)="editarPlatica(p)">
                            Modificar
                          </button>
                          <button
                            matButton
                            type="button"
                            class="peligro"
                            [attr.aria-label]="'Quitar la plática ' + tiposPlatica[p.tipo]"
                            (click)="quitarPlatica(p)"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .pestana {
      margin-top: 16px;
    }
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .encabezado p {
      margin: 0;
      flex: 1 1 20rem;
    }
    .detalle {
      display: block;
      font-size: 12px;
    }
    .acciones {
      white-space: nowrap;
      text-align: right;
    }
    .peligro {
      color: var(--peligro);
    }
  `,
})
export class ServiciosPage {
  private readonly servicio = inject(ServiciosService);
  private readonly dialogo = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);
  private readonly moneda = inject(FormatoMonedaService);

  protected readonly tiposPlatica = ETIQUETAS_TIPO_PLATICA;
  protected readonly horarios = describirHorarios;
  protected readonly duracion = (m: number | null) => describirDuracion(m, '—');
  protected readonly iconoVacio = BookOpen;

  protected readonly filtros = filtrosURL({ tab: 'servicios' });
  protected readonly indice = computed(() => {
    const i = PESTANAS.indexOf(this.filtros.valores().tab as (typeof PESTANAS)[number]);
    return i < 0 ? 0 : i;
  });

  protected readonly servicios = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarServicios(),
  });
  protected readonly listaServicios = computed(() => valorDe(this.servicios) ?? []);
  protected readonly platicas = rxResource({
    params: () => this.servicio.version(),
    stream: () => this.servicio.listarPlaticas(),
  });
  protected readonly listaPlaticas = computed(() => valorDe(this.platicas) ?? []);

  protected cambiarPestana(indice: number) {
    const tab = PESTANAS[indice] ?? 'servicios';
    if (tab !== this.filtros.valores().tab) this.filtros.cambiar({ tab });
  }

  protected costo(s: Servicio) {
    return describirCosto(s.formaCosto, s.monto, this.moneda.codigo());
  }

  protected costoPlatica(p: Platica) {
    return Number(p.costo) === 0 ? 'Gratuita' : this.moneda.formato(p.costo);
  }

  private readonly tamano = { width: '36rem', maxWidth: 'calc(100vw - 32px)' };

  protected editarServicio(s: Servicio | null) {
    this.dialogo.open(ServicioDialogo, { data: s, ...this.tamano });
  }

  protected editarPlatica(p: Platica | null) {
    this.dialogo.open(PlaticaDialogo, { data: p, ...this.tamano });
  }

  protected quitarServicio(s: Servicio) {
    void this.confirmar.abrir({
      titulo: 'Quitar servicio',
      descripcion: `«${s.nombre}» deja de ofrecerse y de mostrarse al público.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.quitarServicio(s.id),
    });
  }

  protected quitarPlatica(p: Platica) {
    void this.confirmar.abrir({
      titulo: 'Quitar plática',
      descripcion: `La plática ${ETIQUETAS_TIPO_PLATICA[p.tipo].toLowerCase()} deja de mostrarse al público.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.quitarPlatica(p.id),
    });
  }
}
