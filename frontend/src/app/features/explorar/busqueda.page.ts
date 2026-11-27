import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { LucideAngularModule, Search } from 'lucide-angular';
import { of } from 'rxjs';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { ETIQUETAS_TIPO_OBJETO, opcionesDe } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import type { Lugar, TipoObjeto } from '@/app/tipos/patrimonio';
import { AvisoDemo, esIglesiaRealDeDemo } from './aviso-demo';
import { TituloColonial } from './explorar-layout';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { TarjetaIglesia } from './tarjeta-iglesia';
import { FOTOS_IGLESIAS } from './fotos-iglesias';

/**
 * /busqueda-patrimonio — el investigador elige un tipo de objeto, una antigüedad mínima y un lugar
 * y ve las iglesias abiertas con al menos un objeto vigente que cumple (E2-14: RF-23, CA-08).
 */
@Component({
  selector: 'app-busqueda-patrimonio',
  imports: [
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatSelectTrigger,
    MatOption,
    LucideAngularModule,
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
    ul {
      margin: 8px 0 0;
      padding-left: 20px;
      font-size: 14px;
    }
  `,
  template: `
    <app-titulo-colonial
      [foto]="foto"
      texto="Búsqueda por patrimonio"
      subtitulo="Por ejemplo: imágenes de 300 años o más en Puebla."
    />
    <div class="pagina">
      <aside class="filtros" aria-label="Qué buscar">
        <h2>Qué buscar</h2>
        <mat-form-field>
          <mat-label>Tipo de objeto</mat-label>
          <mat-select
            [value]="f().tipoObjeto"
            (selectionChange)="filtros.cambiar({ tipoObjeto: $event.value })"
          >
            <!-- En el campo, solo el nombre corto; la lista conserva la descripción completa -->
            <mat-select-trigger>{{ tipoCorto(f().tipoObjeto) }}</mat-select-trigger>
            @for (t of tipos; track t.valor) {
              <mat-option [value]="t.valor">{{ t.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Antigüedad mínima (años)</mat-label>
          <input
            matInput
            type="number"
            min="0"
            inputmode="numeric"
            [value]="f().antiguedadMin"
            (change)="antiguedad($event)"
          />
        </mat-form-field>
        <app-selector-lugar
          textoSinEstado="Elige un estado"
          [estado]="f().estado || undefined"
          [municipio]="f().municipio || undefined"
          [localidad]="f().localidad || undefined"
          (cambio)="lugar($event)"
        />
      </aside>

      <div>
        @if (!listo()) {
          <app-estado-vacio
            [icono]="iconos.Search"
            titulo="Elige qué buscar y dónde"
            descripcion="Un tipo de objeto, cuántos años como mínimo y un estado, municipio o ciudad."
          />
        } @else if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="3" [columnas]="1" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (resultados().length === 0) {
          <app-estado-vacio
            [icono]="iconos.Search"
            titulo="Ninguna iglesia cumple"
            descripcion="Prueba con menos años o con otro lugar."
          />
        } @else {
          @if (hayReales()) {
            <app-aviso-demo />
          }
          <section class="lista" aria-label="Iglesias encontradas">
            @for (r of resultados(); track r.id) {
              <app-tarjeta-iglesia
                [id]="r.id"
                [nombre]="r.nombre"
                [tipo]="r.tipo"
                [estado]="r.estado"
                [municipio]="r.municipio"
                [localidad]="r.localidad"
                [indice]="r.indice"
                [distincion]="r.distincion"
              >
                <ul aria-label="Objetos que cumplen">
                  @for (o of r.objetos; track o.id) {
                    <li>{{ o.descripcion }} ({{ o.epoca }}, {{ o.antiguedad }} años)</li>
                  }
                </ul>
              </app-tarjeta-iglesia>
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
export class BusquedaPage {
  /** Foto de la banda de portada del título. */
  protected readonly foto = FOTOS_IGLESIAS[0];
  private readonly servicio = inject(ExplorarService);
  protected readonly iconos = { Search };
  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_OBJETO);
  /** «Imagen (santo, virgen o cristo)» → «Imagen», para que quepa en el campo. */
  protected tipoCorto(valor: string) {
    const etiqueta = this.tipos.find((t) => t.valor === valor)?.etiqueta ?? '';
    return etiqueta.replace(/\s*\(.*\)$/, '');
  }
  protected readonly filtros = filtrosURL({
    tipoObjeto: 'IMAGEN',
    antiguedadMin: 300,
    estado: '',
    municipio: '',
    localidad: '',
    page: 1,
  });
  protected readonly f = this.filtros.valores;
  protected readonly listo = computed(() => Boolean(this.f().estado));

  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      p.estado
        ? this.servicio.busqueda({
            tipoObjeto: p.tipoObjeto as TipoObjeto,
            antiguedadMin: p.antiguedadMin,
            ...(p.localidad
              ? { localidad: p.localidad }
              : p.municipio
                ? { municipio: p.municipio }
                : { estado: p.estado }),
            page: p.page,
            limit: 20,
          })
        : of(null),
  });
  protected readonly resultados = computed(() => valorDe(this.consulta)?.data ?? []);
  /** Si sale alguna iglesia real de la demo, se avisa que sus objetos son ilustrativos. */
  protected readonly hayReales = computed(() =>
    this.resultados().some((r) => esIglesiaRealDeDemo(r.id)),
  );

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }

  protected antiguedad(evento: Event) {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.filtros.cambiar({ antiguedadMin: Number.isInteger(valor) && valor >= 0 ? valor : 0 });
  }
}
