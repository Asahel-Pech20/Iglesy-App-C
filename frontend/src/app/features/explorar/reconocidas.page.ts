import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Award, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import type { Lugar } from '@/app/tipos/patrimonio';
import { TituloColonial } from './explorar-layout';
import { ExplorarService } from './explorar.service';
import { SelectorLugar } from './selector-lugar';
import { TarjetaIglesia } from './tarjeta-iglesia';
import { FOTOS_IGLESIAS } from './fotos-iglesias';

/**
 * /reconocidas — iglesias más reconocidas del país, de un estado, municipio o ciudad, de mayor a
 * menor índice (E2-14: RF-19–RF-21, CA-06). Sin cerradas ni iglesias sin objetos.
 */
@Component({
  selector: 'app-reconocidas',
  imports: [
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    Paginacion,
    SelectorLugar,
    TarjetaIglesia,
    TituloColonial,
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
      texto="Iglesias más reconocidas"
      subtitulo="Ordenadas por su índice de valor patrimonial, de mayor a menor."
    />
    <div class="pagina">
      <aside class="filtros" aria-label="Lugar">
        <h2>Lugar</h2>
        <app-selector-lugar
          [estado]="f().estado || undefined"
          [municipio]="f().municipio || undefined"
          [localidad]="f().localidad || undefined"
          (cambio)="lugar($event)"
        />
      </aside>
      <div>
        @if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="4" [columnas]="1" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (ranking().length === 0) {
          <app-estado-vacio
            [icono]="iconos.Award"
            titulo="Aún no hay iglesias reconocidas aquí"
            descripcion="Solo aparecen iglesias abiertas con objetos patrimoniales registrados."
          />
        } @else {
          <ol class="lista" aria-label="Ranking de iglesias">
            @for (i of ranking(); track i.id) {
              <li>
                <app-tarjeta-iglesia
                  [id]="i.id"
                  [nombre]="i.nombre"
                  [tipo]="i.tipo"
                  [estado]="i.estado"
                  [municipio]="i.municipio"
                  [localidad]="i.localidad"
                  [indice]="i.indice"
                  [distincion]="i.distincion"
                  [posicion]="i.posicion"
                />
              </li>
            }
          </ol>
          <app-paginacion
            [meta]="consulta.value()!.meta"
            (cambio)="filtros.cambiar({ page: $event })"
          />
        }
      </div>
    </div>
  `,
})
export class ReconocidasPage {
  /** Foto de la banda de portada del título. */
  protected readonly foto = FOTOS_IGLESIAS[1];
  private readonly servicio = inject(ExplorarService);
  protected readonly iconos = { Award };
  protected readonly filtros = filtrosURL({ estado: '', municipio: '', localidad: '', page: 1 });
  protected readonly f = this.filtros.valores;

  /** El backend acepta un solo nivel de lugar: se manda el más específico. */
  protected readonly consulta = rxResource({
    params: () => this.f(),
    stream: ({ params: p }) =>
      this.servicio.reconocidas({
        ...(p.localidad
          ? { localidad: p.localidad }
          : p.municipio
            ? { municipio: p.municipio }
            : p.estado
              ? { estado: p.estado }
              : {}),
        page: p.page,
        limit: 20,
      }),
  });
  protected readonly ranking = computed(() => valorDe(this.consulta)?.data ?? []);

  protected lugar(l: Lugar) {
    this.filtros.cambiar({
      estado: l.estado ?? '',
      municipio: l.municipio ?? '',
      localidad: l.localidad ?? '',
    });
  }
}
