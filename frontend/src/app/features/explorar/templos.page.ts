import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { Church, LucideAngularModule } from 'lucide-angular';
import { of } from 'rxjs';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_IGLESIA, opcionesDe } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import type { TipoIglesia } from '@/app/tipos/iglesias';
import type { Lugar } from '@/app/tipos/patrimonio';
import { TituloColonial } from './explorar-layout';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { AvisoDemo, esIglesiaRealDeDemo } from './aviso-demo';
import { TarjetaIglesia } from './tarjeta-iglesia';
import { FOTOS_IGLESIAS } from './fotos-iglesias';

/**
 * /templos — el visitante elige un estado y ve sus iglesias activas; acota por municipio,
 * localidad, tipo, nombre y capacidad (E2-14: RF-01–RF-05, RF-18, CA-02, CA-03).
 */
@Component({
  selector: 'app-templos',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    LucideAngularModule,
    CampoBusqueda,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
    SelectorLugar,
    TarjetaIglesia,
    TituloColonial,
    AvisoDemo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .pagina {
      display: grid;
      gap: 24px;
      align-items: start;
    }
    /* Filtros en una barra horizontal sobre los resultados: cada campo tiene al menos 220 px, así
       que las opciones largas («Imagen (santo, virgen o cristo)») ya no se cortan */
    .filtros {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      gap: 0 16px;
      align-items: start;
      padding: 16px 20px 4px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      border-radius: 16px;
      box-shadow: 0 2px 12px rgb(0 0 0 / 0.06);
    }
    .filtros h2 {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 400;
      color: var(--primario);
    }
    .filtros h2::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--acento);
      transform: rotate(45deg);
    }
    .filtros mat-form-field,
    .filtros app-campo-busqueda {
      width: 100%;
    }
    .filtros mat-label {
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--primario);
    }
    .lista {
      display: grid;
      gap: 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 768px) {
      .lista {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (min-width: 1200px) {
      .lista {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  `,
  template: `
    <app-titulo-colonial
      [foto]="foto"
      texto="Iglesias de México"
      subtitulo="Elige un estado para ver sus iglesias y su valor patrimonial."
    />

    <div class="pagina">
      <aside class="filtros" aria-label="Filtros">
        <h2>Buscar</h2>
        <app-selector-lugar
          textoSinEstado="Elige un estado"
          [estado]="f().estado || undefined"
          [municipio]="f().municipio || undefined"
          [localidad]="f().localidad || undefined"
          (cambio)="lugar($event)"
        />
        @if (f().estado) {
          <mat-form-field>
            <mat-label>Tipo</mat-label>
            <mat-select
              [value]="f().tipo"
              (selectionChange)="filtros.cambiar({ tipo: $event.value })"
            >
              <mat-option value="">Todos</mat-option>
              @for (t of tipos; track t.valor) {
                <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <app-campo-busqueda
            etiqueta="Nombre"
            placeholder="Parte del nombre…"
            [valor]="f().q"
            (cambio)="filtros.cambiar({ q: $event })"
          />
          <mat-form-field>
            <mat-label>Cupo mínimo</mat-label>
            <input
              matInput
              type="number"
              min="1"
              inputmode="numeric"
              [value]="f().capacidadMin || ''"
              (change)="capacidad('capacidadMin', $event)"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Cupo máximo</mat-label>
            <input
              matInput
              type="number"
              min="1"
              inputmode="numeric"
              [value]="f().capacidadMax || ''"
              (change)="capacidad('capacidadMax', $event)"
            />
          </mat-form-field>
        }
      </aside>

      <div>
        @if (!f().estado) {
          <app-estado-vacio
            [icono]="iconos.Church"
            titulo="Elige un estado"
            descripcion="Después puedes acotar por municipio, ciudad, tipo, nombre o capacidad."
          />
        } @else if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="4" [columnas]="1" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (iglesias().length === 0) {
          <app-estado-vacio
            [icono]="iconos.Church"
            titulo="No hay iglesias con esos filtros"
            descripcion="Quita algún filtro para ver más iglesias del estado."
          />
        } @else {
          @if (hayReales()) {
            <app-aviso-demo />
          }
          <section class="lista" aria-label="Iglesias del estado">
            @for (i of iglesias(); track i.id) {
              <app-tarjeta-iglesia
                [id]="i.id"
                [nombre]="i.nombre"
                [tipo]="i.tipo"
                [municipio]="i.municipio"
                [localidad]="i.localidad"
                [indice]="i.indice"
                [distincion]="i.distincion"
                [foto]="i.foto"
              />
            }
          </section>
          <app-paginacion
            [meta]="consulta.value()!.meta"
            (cambio)="filtros.cambiar({ page: $event })"
          />
        }
      </div>
    </div>
  `,
})
export class TemplosPage {
  /** Foto de la banda de portada del título. */
  protected readonly foto = FOTOS_IGLESIAS[2];
  private readonly servicio = inject(ExplorarService);

  protected readonly iconos = { Church };
  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_IGLESIA);
  protected readonly filtros = filtrosURL({
    estado: '',
    municipio: '',
    localidad: '',
    tipo: '',
    q: '',
    capacidadMin: 0,
    capacidadMax: 0,
    page: 1,
  });
  protected readonly f = this.filtros.valores;

  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      p.estado
        ? this.servicio.iglesias({
            estado: p.estado,
            municipio: p.municipio || undefined,
            localidad: p.localidad || undefined,
            tipo: (p.tipo || undefined) as TipoIglesia | undefined,
            q: p.q || undefined,
            capacidadMin: p.capacidadMin || undefined,
            capacidadMax: p.capacidadMax || undefined,
            page: p.page,
            limit: 20,
          })
        : of(null),
  });
  protected readonly iglesias = computed(() => valorDe(this.consulta)?.data ?? []);
  /** Si sale alguna iglesia real de la demo, se avisa que sus objetos e índice son ilustrativos. */
  protected readonly hayReales = computed(() =>
    this.iglesias().some((i) => esIglesiaRealDeDemo(i.id) || Boolean(i.foto)),
  );

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }

  protected capacidad(campo: 'capacidadMin' | 'capacidadMax', evento: Event) {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.filtros.cambiar({ [campo]: Number.isInteger(valor) && valor > 0 ? valor : 0 });
  }
}
