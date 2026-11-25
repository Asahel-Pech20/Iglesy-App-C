import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Church, LucideAngularModule, Plus } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_IGLESIA, formatearFecha } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { valorDe } from '@/app/core/recurso';
import type { Iglesia, SituacionIglesia } from '@/app/tipos/iglesias';
import { CerrarIglesiaDialogo } from './cerrar-iglesia.dialogo';
import { IglesiaFormDialogo } from './iglesia-form.dialogo';
import { IglesiasService } from './iglesias.service';

const ANCHO = { width: '40rem', maxWidth: 'calc(100vw - 32px)' };

/**
 * /iglesias — iglesias del sistema nacional (Coordinación). Base de Oscar ampliada en E2-15:
 * ubicación, situación (RF-12), edición, cierre y acceso a su patrimonio.
 */
@Component({
  selector: 'app-iglesias',
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
    CampoBusqueda,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .suave {
      color: var(--texto-suave);
      font-size: 12px;
    }
  `,
  template: `
    <app-page-header
      titulo="Iglesias"
      descripcion="Iglesias del sistema. Cada una tiene su propio personal, patrimonio y diezmo."
    >
      <button *appPuede="'iglesias:crear'" matButton="filled" type="button" (click)="nueva()">
        <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Nueva iglesia
      </button>
    </app-page-header>

    <div class="filtros">
      <app-campo-busqueda
        etiqueta="Buscar por nombre"
        [valor]="filtros.valores().q"
        (cambio)="filtros.cambiar({ q: $event })"
      />
      <mat-form-field>
        <mat-label>Situación</mat-label>
        <mat-select
          [value]="filtros.valores().situacion"
          (selectionChange)="filtros.cambiar({ situacion: $event.value })"
        >
          <mat-option value="todas">Todas</mat-option>
          <mat-option value="activas">Activas</mat-option>
          <mat-option value="cerradas">Cerradas</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <section class="tarjeta">
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="4" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (datos().length === 0) {
        <app-estado-vacio
          [icono]="iconos.Church"
          titulo="No hay iglesias con esos filtros"
          descripcion="Crea una iglesia o cambia la búsqueda."
        >
          <button *appPuede="'iglesias:crear'" matButton="filled" type="button" (click)="nueva()">
            Nueva iglesia
          </button>
        </app-estado-vacio>
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Iglesias">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Lugar</th>
                <th scope="col">Situación</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (i of datos(); track i.id) {
                <tr>
                  <td>
                    <span class="nombre-colonial">{{ i.nombre }}</span>
                    <div class="suave">{{ i.zonaHoraria }}</div>
                  </td>
                  <td>{{ tipos[i.tipo] }}</td>
                  <td>{{ lugar(i) }}</td>
                  <td>
                    @if (i.activa) {
                      <app-badge-estado etiqueta="Activa" variante="exito" />
                    } @else {
                      <app-badge-estado etiqueta="Cerrada" variante="neutro" />
                      <div class="suave">{{ fecha(i.fechaCierre) }} · {{ i.motivoCierre }}</div>
                    }
                  </td>
                  <td>
                    <div class="acciones">
                      <a
                        *appPuede="'patrimonio:leer'"
                        matButton
                        [routerLink]="['/iglesias', i.id, 'patrimonio']"
                        >Patrimonio</a
                      >
                      @if (i.activa) {
                        <button
                          *appPuede="'iglesias:editar'"
                          matButton
                          type="button"
                          (click)="editar(i)"
                        >
                          Editar
                        </button>
                        <button
                          *appPuede="'iglesias:cerrar'"
                          matButton
                          type="button"
                          (click)="cerrar(i)"
                        >
                          Cerrar
                        </button>
                      }
                    </div>
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
  `,
})
export class IglesiasPage {
  private readonly servicio = inject(IglesiasService);
  private readonly dialogo = inject(MatDialog);

  protected readonly filtros = filtrosURL({
    q: '',
    situacion: 'todas' as SituacionIglesia,
    page: 1,
  });
  protected readonly iconos = { Church, Plus };
  protected readonly tipos = ETIQUETAS_TIPO_IGLESIA;
  protected readonly fecha = formatearFecha;

  protected readonly consulta = rxResource({
    params: () => ({ ...this.filtros.valores(), limit: 20, v: this.servicio.version() }),
    stream: ({ params: { v: _v, ...query } }) => this.servicio.listar(query),
  });
  protected readonly datos = computed(() => valorDe(this.consulta)?.data ?? []);

  protected lugar(i: Iglesia) {
    return (
      [i.localidad?.nombre ?? i.municipio?.nombre, i.estado?.nombre].filter(Boolean).join(', ') ||
      'Sin ubicación'
    );
  }

  protected nueva() {
    this.dialogo.open(IglesiaFormDialogo, ANCHO);
  }

  protected editar(iglesia: Iglesia) {
    this.dialogo.open(IglesiaFormDialogo, { ...ANCHO, data: iglesia });
  }

  protected cerrar(iglesia: Iglesia) {
    this.dialogo.open(CerrarIglesiaDialogo, {
      width: '28rem',
      maxWidth: 'calc(100vw - 32px)',
      data: iglesia,
    });
  }
}
