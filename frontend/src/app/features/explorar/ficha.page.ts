import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Mail, MapPin, Phone, Users } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { ETIQUETAS_TIPO_IGLESIA, ETIQUETAS_TIPO_OBJETO, formatearIndice } from '@/app/core/formato';
import { ETIQUETAS_CLASE } from '@/app/features/espacios/formato-espacios';
import { valorDe } from '@/app/core/recurso';
import type { FichaIglesia } from '@/app/tipos/patrimonio';
import { ExplorarService } from './explorar.service';
import { varianteDistincion } from './tarjeta-iglesia';

/**
 * /templos/:id — ficha de una iglesia en una sola pantalla: datos, objetos vigentes, índice y
 * distinción (E2-14: RF-06, RF-16–RF-18, CA-04). Servicios, pláticas, misas y espacios los
 * agregan sus dueños cuando existan.
 */
@Component({
  selector: 'app-ficha-iglesia',
  imports: [RouterLink, LucideAngularModule, BadgeEstado, EstadoError, Esqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    h1 {
      font-size: 24px;
      margin: 8px 0 4px;
      overflow-wrap: anywhere;
    }
    .suave {
      color: var(--texto-suave);
    }
    .indice {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      padding: 16px;
      margin: 16px 0;
    }
    .indice strong {
      font-size: 28px;
    }
    .datos {
      display: grid;
      gap: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .datos p {
      display: flex;
      gap: 8px;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .objetos {
      display: grid;
      gap: 8px;
      padding: 0;
      list-style: none;
    }
    .objetos li {
      padding: 12px 16px;
    }
    .objetos h3 {
      font-size: 16px;
      margin: 0 0 4px;
    }
  `,
  template: `
    <a routerLink="/templos" class="suave">← Volver a la lista</a>
    @if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="6" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (ficha(); as f) {
      <h1>{{ f.nombre }}</h1>
      <p class="suave">{{ tipos[f.tipo] }} · {{ lugar() }}</p>

      <section class="tarjeta indice" aria-label="Índice patrimonial">
        <div>
          <span class="suave">Índice patrimonial ({{ f.anioCalculo }})</span><br />
          <strong>{{ formato(f.indice) }}</strong>
        </div>
        <app-badge-estado
          [etiqueta]="f.distincion ?? 'Sin distinción'"
          [variante]="variante(f.distincion)"
        />
      </section>

      <section class="tarjeta datos" aria-label="Datos de la iglesia">
        @if (f.ubicacion.direccion) {
          <p>
            <lucide-icon [img]="iconos.MapPin" [size]="16" aria-hidden="true" />{{
              f.ubicacion.direccion
            }}
          </p>
        }
        @if (f.capacidad) {
          <p>
            <lucide-icon [img]="iconos.Users" [size]="16" aria-hidden="true" />Caben
            {{ f.capacidad }} personas
          </p>
        }
        @if (f.anioConstruccion) {
          <p>Construida en {{ f.anioConstruccion }}</p>
        }
        @if (f.contacto.telefono) {
          <p>
            <lucide-icon [img]="iconos.Phone" [size]="16" aria-hidden="true" />{{
              f.contacto.telefono
            }}
          </p>
        }
        @if (f.contacto.correo) {
          <p>
            <lucide-icon [img]="iconos.Mail" [size]="16" aria-hidden="true" />{{
              f.contacto.correo
            }}
          </p>
        }
        @if (f.coordenadas; as c) {
          <p class="suave">Coordenadas: {{ c.latitud }}, {{ c.longitud }}</p>
        }
      </section>

      @if (f.tiposEspacio.length > 0) {
        <section class="tarjeta datos" aria-labelledby="titulo-espacios">
          <h2 id="titulo-espacios" style="margin: 0">Espacios</h2>
          <p class="suave" style="margin: 0">
            Esta iglesia ofrece:
            {{ espacios(f.tiposEspacio) }}.
          </p>
          <a [routerLink]="['/espacios', f.id]">Solicitar un espacio</a>
        </section>
      }

      <h2>Patrimonio</h2>
      @if (f.objetos.length === 0) {
        <p class="suave">Esta iglesia no tiene objetos vigentes registrados.</p>
      } @else {
        <ul class="objetos" aria-label="Objetos vigentes">
          @for (o of f.objetos; track o.id) {
            <li class="tarjeta">
              <h3>{{ o.descripcion }}</h3>
              <span class="suave">
                {{ tiposObjeto[o.tipo] }} · {{ o.epoca }} · {{ o.material }}
              </span>
              @if (o.catalogadoInah) {
                <app-badge-estado etiqueta="Catalogado por el INAH" variante="primario" />
              }
            </li>
          }
        </ul>
      }
    }
  `,
})
export class FichaPage {
  readonly id = input.required<string>();
  private readonly servicio = inject(ExplorarService);

  protected readonly iconos = { Mail, MapPin, Phone, Users };
  protected readonly tipos = ETIQUETAS_TIPO_IGLESIA;
  protected readonly tiposObjeto = ETIQUETAS_TIPO_OBJETO;
  protected readonly formato = formatearIndice;
  protected readonly variante = varianteDistincion;

  /** «cripta, nicho y columbario» con las etiquetas de Oscar. */
  protected espacios(tipos: FichaIglesia['tiposEspacio']) {
    const nombres = tipos.map((t) => ETIQUETAS_CLASE[t.clase].toLowerCase());
    return nombres.length > 1
      ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
      : (nombres[0] ?? '');
  }

  protected readonly consulta = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.servicio.ficha(params),
  });
  protected readonly ficha = computed(() => valorDe(this.consulta) ?? null);
  protected readonly lugar = computed(() => {
    const u = this.ficha()?.ubicacion;
    return (
      [u?.localidad?.nombre, u?.municipio?.nombre, u?.estado?.nombre]
        // Sin repetir un nombre igual al anterior («Puebla, Puebla»)
        .filter((n, i, lista) => Boolean(n) && n !== lista[i - 1])
        .join(', ')
    );
  });
}
