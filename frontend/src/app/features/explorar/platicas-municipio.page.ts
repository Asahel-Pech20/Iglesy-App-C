import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { BookOpen, LucideAngularModule } from 'lucide-angular';
import { of } from 'rxjs';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { filtrosURL } from '@/app/core/filtros-url';
import { formatearMoneda, opcionesDe } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { describirHorarios, ETIQUETAS_TIPO_PLATICA } from '@/app/features/misas/formato-misas';
import { ServiciosService } from '@/app/features/servicios/servicios.service';
import type { Lugar } from '@/app/tipos/patrimonio';
import type { PlaticaPublica, TipoPlatica } from '@/app/tipos/servicios';
import { TituloColonial } from './explorar-layout';
import { FOTOS_IGLESIAS } from './fotos-iglesias';
import { SelectorLugar } from './selector-lugar';

/**
 * /platicas — RF-83 (deseable, supuesto P-29): las pláticas de un tipo en todas las iglesias de un
 * municipio, con su iglesia, días y hora. Sin sesión (RN-33).
 */
@Component({
  selector: 'app-platicas-municipio',
  imports: [
    RouterLink,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    TituloColonial,
    SelectorLugar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-titulo-colonial
      [foto]="foto"
      texto="Pláticas en tu municipio"
      subtitulo="Elige el tipo de plática y el municipio para ver en qué iglesias y cuándo se imparte."
    />
    <div class="pagina">
      <aside class="filtros" aria-label="Filtros">
        <h2>Buscar pláticas</h2>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Tipo de plática</mat-label>
          <mat-select
            [value]="f().tipo"
            (selectionChange)="filtros.cambiar({ tipo: $event.value })"
          >
            @for (t of tipos; track t.valor) {
              <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <app-selector-lugar
          textoSinEstado="Elige un estado"
          [estado]="f().estado || undefined"
          [municipio]="f().municipio || undefined"
          (cambio)="lugar($event)"
        />
      </aside>

      <div>
        @if (!f().municipio) {
          <app-estado-vacio
            [icono]="icono"
            titulo="Elige un estado y un municipio"
            descripcion="Verás las pláticas del tipo elegido en todas sus iglesias."
          />
        } @else if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="4" [columnas]="3" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (grupos().length === 0) {
          <app-estado-vacio
            [icono]="icono"
            titulo="No hay pláticas de ese tipo en el municipio"
            descripcion="Prueba con otro tipo de plática o con otro municipio."
          />
        } @else {
          <ul class="lista" aria-label="Pláticas por iglesia">
            @for (g of grupos(); track g.iglesia.id) {
              <li class="tarjeta-colonial">
                <h3>
                  <a [routerLink]="['/templos', g.iglesia.id]">{{ g.iglesia.nombre }}</a>
                </h3>
                @for (p of g.platicas; track $index) {
                  <p class="cuando">{{ horarios(p.horarios) }}</p>
                  <p class="detalle">
                    {{ p.sesiones }} sesiones · {{ costo(p) }} · cupo {{ p.cupo }} · {{ p.lugar }} ·
                    {{ p.imparte }}
                  </p>
                }
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: `
    .pagina {
      display: grid;
      gap: 16px;
      align-items: start;
    }
    @media (min-width: 900px) {
      .pagina {
        grid-template-columns: 18rem 1fr;
      }
    }
    .filtros {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      border-radius: 4px;
    }
    .filtros h2 {
      margin: 0 0 8px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      font-weight: 400;
      color: var(--primario);
    }
    .filtros mat-form-field {
      width: 100%;
    }
    .lista {
      display: grid;
      gap: 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tarjeta-colonial {
      padding: 12px 14px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      margin: 4px;
    }
    h3 {
      margin: 0 0 6px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px;
      font-weight: 400;
    }
    .cuando {
      margin: 0;
      font-weight: 500;
    }
    .detalle {
      margin: 0 0 6px;
      font-size: 13px;
      color: var(--texto-suave);
    }
  `,
})
export class PlaticasMunicipioPage {
  /** Foto de la banda de portada, como las demás consultas públicas. */
  protected readonly foto = FOTOS_IGLESIAS[3];
  private readonly servicio = inject(ServiciosService);

  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_PLATICA);
  protected readonly horarios = describirHorarios;
  protected readonly icono = BookOpen;
  protected readonly filtros = filtrosURL({ tipo: 'PREBAUTISMAL', estado: '', municipio: '' });
  protected readonly f = this.filtros.valores;

  protected readonly consulta = rxResource({
    params: () => ({ tipo: this.f().tipo as TipoPlatica, municipio: this.f().municipio }),
    stream: ({ params }) =>
      params.municipio ? this.servicio.platicasDelMunicipio(params.tipo, params.municipio) : of([]),
  });
  protected readonly grupos = computed(() => valorDe(this.consulta) ?? []);

  protected lugar(l: Lugar) {
    this.filtros.cambiar({ estado: l.estado ?? '', municipio: l.municipio ?? '' });
  }

  protected costo(p: PlaticaPublica) {
    return Number(p.costo) === 0 ? 'gratuita' : formatearMoneda(p.costo);
  }
}
