import type { ComponentType } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Gem, LucideAngularModule, Pencil, Plus } from 'lucide-angular';
import { of } from 'rxjs';
import { BadgeEstado, type VarianteBadge } from '@/app/compartido/badge-estado';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import {
  ETIQUETAS_ESTADO_OBJETO,
  ETIQUETAS_TIPO_OBJETO,
  formatearIndice,
} from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import { IglesiaFormDialogo } from '@/app/features/iglesias/iglesia-form.dialogo';
import { IglesiasService } from '@/app/features/iglesias/iglesias.service';
import type { EstadoObjeto, ObjetoPatrimonial } from '@/app/tipos/patrimonio';
import { EstadoObjetoDialogo } from './estado-objeto.dialogo';
import { ObjetoFormDialogo } from './objeto-form.dialogo';
import { PatrimonioService } from './patrimonio.service';

const VARIANTE: Record<EstadoObjeto, VarianteBadge> = {
  VIGENTE: 'exito',
  PRESTADO: 'alerta',
  PERDIDO: 'peligro',
  BAJA: 'neutro',
};

/**
 * /patrimonio (administrador: su iglesia) y /iglesias/:id/patrimonio (Coordinación, también de
 * iglesias cerradas, RF-12). Objetos con sus puntos, índice y distinción (E2-15, RF-13–RF-18).
 */
@Component({
  selector: 'app-patrimonio',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    RouterLink,
    LucideAngularModule,
    PuedeDirective,
    PageHeader,
    BadgeEstado,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .resumen {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      margin-bottom: 16px;
    }
    .dato {
      padding: 12px 16px;
    }
    .dato strong {
      display: block;
      font-size: 24px;
    }
    /* E2-15: el índice con el sello dorado del estilo colonial (igual que la ficha pública) */
    .sello {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .circulo {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 76px;
      height: 76px;
      margin: 4px;
      border: 2px solid var(--acento);
      outline: 1px solid var(--acento);
      outline-offset: 3px;
      border-radius: 50%;
      color: var(--acento);
      font-size: 26px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
    }
    .dato .serifa {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    .suave {
      color: var(--texto-suave);
      font-size: 12px;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
  template: `
    <app-page-header
      [titulo]="'Patrimonio' + (iglesia()?.nombre ? ' · ' + iglesia()!.nombre : '')"
      descripcion="Objetos de la iglesia. Solo los vigentes suman al índice; ninguno se borra."
    >
      @if (puedeCapturar()) {
        <!-- RF-08: el encargado edita los datos de SU iglesia (antes solo podía la Coordinación) -->
        <button
          *appPuede="'iglesias:editar'"
          matButton="outlined"
          type="button"
          (click)="editarIglesia()"
        >
          <lucide-icon [img]="iconos.Pencil" [size]="16" aria-hidden="true" /> Editar datos de la
          iglesia
        </button>
        <button
          *appPuede="'patrimonio:gestionar'"
          matButton="filled"
          type="button"
          (click)="nuevo()"
        >
          <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Nuevo objeto
        </button>
      }
    </app-page-header>

    @if (!iglesiaId()) {
      <app-estado-vacio
        [icono]="iconos.Gem"
        titulo="Elige una iglesia"
        descripcion="La Coordinación consulta el patrimonio desde la lista de iglesias."
      >
        <a matButton="filled" routerLink="/iglesias">Ir a iglesias</a>
      </app-estado-vacio>
    } @else {
      @if (iglesia() && !iglesia()!.activa) {
        <p class="alerta" role="status">
          Iglesia cerrada: se consulta su historia, pero ya no se capturan objetos.
        </p>
      }
      @if (indice(); as i) {
        <section class="resumen" aria-label="Índice patrimonial">
          <div class="tarjeta dato sello">
            <span class="circulo">{{ formatoIndice(i.indice) }}</span>
            <div>
              <span class="suave">Índice ({{ i.anioCalculo }})</span>
              <strong class="serifa">{{ i.distincion ?? 'Sin distinción' }}</strong>
            </div>
          </div>
          <div class="tarjeta dato">
            <span class="suave">Objetos vigentes</span>
            <strong>{{ i.objetosVigentes }} de {{ i.objetosRegistrados }}</strong>
          </div>
        </section>
      }

      <mat-form-field>
        <mat-label>Estado del objeto</mat-label>
        <mat-select
          [value]="filtros.valores().estado"
          (selectionChange)="filtros.cambiar({ estado: $event.value })"
        >
          <mat-option value="">Todos</mat-option>
          @for (e of estados; track e[0]) {
            <mat-option [value]="e[0]">{{ e[1] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <section class="tarjeta">
        @if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="5" [columnas]="5" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (objetos().length === 0) {
          <app-estado-vacio
            [icono]="iconos.Gem"
            titulo="Sin objetos registrados"
            descripcion="Registra las piezas de la iglesia para calcular su índice patrimonial."
          />
        } @else {
          <div class="contenedor-tabla">
            <table class="tabla-simple" aria-label="Objetos del patrimonio">
              <thead>
                <tr>
                  <th scope="col">Objeto</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Época</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Puntos</th>
                  <th scope="col"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (o of objetos(); track o.id) {
                  <tr>
                    <td>
                      {{ o.descripcion }}
                      <div class="suave">
                        {{ o.material }} · {{ o.ubicacionEnTemplo }}
                        @if (o.catalogadoInah) {
                          · INAH
                        }
                      </div>
                    </td>
                    <td>{{ tiposObjeto[o.tipo] }}</td>
                    <td>
                      {{ o.epoca }}
                      <div class="suave">{{ o.antiguedad }} años</div>
                    </td>
                    <td>
                      <app-badge-estado
                        [etiqueta]="estadosObjeto[o.estado]"
                        [variante]="variante[o.estado]"
                      />
                      @if (o.motivoEstado && o.estado !== 'VIGENTE') {
                        <div class="suave">{{ o.motivoEstado }}</div>
                      }
                    </td>
                    <td>{{ formatoIndice(o.puntos) }}</td>
                    <td>
                      @if (puedeCapturar() && o.estado !== 'BAJA') {
                        <div class="acciones" *appPuede="'patrimonio:gestionar'">
                          <button matButton type="button" (click)="editar(o)">Editar</button>
                          <button matButton type="button" (click)="cambiarEstado(o)">
                            Cambiar estado
                          </button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion
            [meta]="consulta.value()!.meta"
            (cambio)="filtros.cambiar({ page: $event })"
          />
        }
      </section>
    }
  `,
})
export class PatrimonioPage {
  /** :id de /iglesias/:id/patrimonio; sin él, la iglesia del usuario. */
  readonly id = input<string | undefined>(undefined);

  private readonly servicio = inject(PatrimonioService);
  private readonly iglesias = inject(IglesiasService);
  private readonly sesion = inject(SesionService);
  private readonly dialogo = inject(MatDialog);

  protected readonly iconos = { Gem, Pencil, Plus };
  protected readonly tiposObjeto = ETIQUETAS_TIPO_OBJETO;
  protected readonly estadosObjeto = ETIQUETAS_ESTADO_OBJETO;
  protected readonly estados = Object.entries(ETIQUETAS_ESTADO_OBJETO);
  protected readonly variante = VARIANTE;
  protected readonly formatoIndice = formatearIndice;
  protected readonly filtros = filtrosURL({ estado: '', page: 1 });

  protected readonly iglesiaId = computed(() => this.id() ?? this.sesion.iglesia()?.id ?? null);

  private readonly datosIglesia = rxResource({
    params: () => ({ id: this.iglesiaId(), v: this.iglesias.version() }),
    stream: ({ params: { id } }) => (id ? this.iglesias.obtener(id) : of(null)),
  });
  protected readonly iglesia = computed(() => valorDe(this.datosIglesia) ?? null);
  /** Solo se captura en iglesias activas (en una cerrada el backend responde 422). */
  protected readonly puedeCapturar = computed(() => this.iglesia()?.activa === true);

  private readonly datosIndice = rxResource({
    params: () => ({ id: this.iglesiaId(), v: this.servicio.version() }),
    stream: ({ params: { id } }) => (id ? this.servicio.indice(id) : of(null)),
  });
  protected readonly indice = computed(() => valorDe(this.datosIndice) ?? null);

  protected readonly consulta = rxResource({
    params: () => ({
      id: this.iglesiaId(),
      ...this.filtros.valores(),
      v: this.servicio.version(),
    }),
    stream: ({ params: { id, v: _v, estado, page } }) =>
      id
        ? this.servicio.objetos(id, {
            page,
            limit: 20,
            estado: (estado || undefined) as EstadoObjeto,
          })
        : of({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  });
  protected readonly objetos = computed(() => valorDe(this.consulta)?.data ?? []);

  private abrir(componente: ComponentType<unknown>, objeto?: ObjetoPatrimonial) {
    const iglesiaId = this.iglesiaId();
    if (!iglesiaId) return;
    this.dialogo.open(componente, {
      width: '32rem',
      maxWidth: 'calc(100vw - 32px)',
      data: { iglesiaId, objeto },
    });
  }

  /** Abre el formulario de la ficha (el mismo de la Coordinación) con los datos de esta iglesia. */
  protected editarIglesia() {
    const iglesia = this.iglesia();
    if (!iglesia) return;
    this.dialogo.open(IglesiaFormDialogo, {
      width: '40rem',
      maxWidth: 'calc(100vw - 32px)',
      data: iglesia,
    });
  }

  protected nuevo() {
    this.abrir(ObjetoFormDialogo);
  }

  protected editar(objeto: ObjetoPatrimonial) {
    this.abrir(ObjetoFormDialogo, objeto);
  }

  protected cambiarEstado(objeto: ObjetoPatrimonial) {
    this.abrir(EstadoObjetoDialogo, objeto);
  }
}
