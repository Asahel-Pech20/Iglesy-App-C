import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  CalendarDays,
  LucideAngularModule,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-angular';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import {
  DIAS_SEMANA,
  ETIQUETAS_TIPO_IGLESIA,
  ETIQUETAS_TIPO_OBJETO,
  formatearFechaHora,
  formatearIndice,
} from '@/app/core/formato';
import { ETIQUETAS_CLASE } from '@/app/features/espacios/formato-espacios';
import { valorDe } from '@/app/core/recurso';
import type { FichaIglesia } from '@/app/tipos/patrimonio';
import { TituloColonial } from './explorar-layout';
import { MisasServiciosFicha } from './misas-servicios-ficha';
import { ExplorarService } from './explorar.service';
import { PildoraDistincion } from './tarjeta-iglesia';

/**
 * /templos/:id — ficha de una iglesia en una sola pantalla: datos, objetos vigentes, índice y
 * distinción (E2-14: RF-06, RF-16–RF-18, CA-04), en estilo colonial. Los tipos de espacio vienen
 * de Oscar; el horario de misas, los servicios y las pláticas, de Genaro (E3-18).
 */
@Component({
  selector: 'app-ficha-iglesia',
  imports: [
    RouterLink,
    LucideAngularModule,
    EstadoError,
    Esqueleto,
    PildoraDistincion,
    MisasServiciosFicha,
    TituloColonial,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .volver {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 12px;
      color: var(--primario);
      text-decoration: none;
      font-size: 14px;
    }
    .cabecera {
      padding: 20px 16px;
      text-align: center;
      background: var(--primario);
      color: var(--primario-texto);
      border-bottom: 3px double var(--acento);
      border-radius: 4px 4px 0 0;
    }
    .cabecera h1 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: 400;
      overflow-wrap: anywhere;
    }
    .cabecera p {
      margin: 6px 0 0;
      font-size: 12px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .cuerpo {
      display: grid;
      gap: 20px;
      margin-top: 20px;
      align-items: start;
    }
    /* Columna derecha: misas, servicios y pláticas, y el patrimonio debajo (no en la de 260 px) */
    .principal {
      display: grid;
      gap: 20px;
      min-width: 0;
    }
    .marco {
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      margin: 4px;
    }
    .sello {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 20px 16px;
      text-align: center;
    }
    .circulo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 96px;
      height: 96px;
      margin: 6px 0;
      border: 2px solid var(--acento);
      outline: 1px solid var(--acento);
      outline-offset: 3px;
      border-radius: 50%;
      color: var(--acento);
    }
    .numero {
      font-size: 26px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
    }
    .etiqueta {
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--texto-suave);
    }
    .datos {
      display: grid;
      gap: 10px;
      padding: 16px;
    }
    .datos p {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .datos lucide-icon {
      flex-shrink: 0;
      color: var(--acento);
    }
    .suave {
      color: var(--texto-suave);
    }
    .espacios {
      display: grid;
      gap: 8px;
      padding: 16px;
    }
    .espacios h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 400;
      color: var(--primario);
    }
    .espacios p {
      margin: 0;
    }
    .objetos {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .objetos li {
      padding: 12px 14px;
    }
    .objetos h3 {
      margin: 0 0 4px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      font-weight: 400;
    }
    .objetos .detalle {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: var(--texto-suave);
    }
    .cartelera {
      display: grid;
      gap: 12px;
      padding: 16px;
    }
    .cartelera h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 400;
      color: var(--primario);
    }
    .cartelera h3 {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--texto-suave);
    }
    .cartelera ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 14px;
    }
    .cartelera .fecha {
      display: block;
      font-size: 12px;
      color: var(--texto-suave);
    }
    .inah {
      display: inline-block;
      padding: 1px 10px;
      border: 1px solid var(--primario);
      border-radius: 999px;
      font-size: 12px;
      color: var(--primario);
    }
    @media (min-width: 768px) {
      .cuerpo {
        grid-template-columns: 260px minmax(0, 1fr);
      }
      .objetos {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  template: `
    <a routerLink="/templos" class="volver">
      <lucide-icon [img]="iconos.ArrowLeft" [size]="16" aria-hidden="true" /> Volver a la lista
    </a>
    @if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="6" [columnas]="1" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (ficha(); as f) {
      <header class="cabecera">
        <h1>{{ f.nombre }}</h1>
        <p>{{ subtitulo() }}</p>
      </header>

      <div class="cuerpo">
        <div>
          <section class="marco sello" aria-label="Índice patrimonial">
            <span class="etiqueta">Índice patrimonial ({{ f.anioCalculo }})</span>
            <div class="circulo">
              <span class="numero">{{ formato(f.indice) }}</span>
            </div>
            <app-pildora-distincion [distincion]="f.distincion" />
          </section>

          <section class="marco datos" aria-label="Datos de la iglesia" style="margin-top: 16px">
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
              <p>
                <lucide-icon [img]="iconos.CalendarDays" [size]="16" aria-hidden="true" />Construida
                en {{ f.anioConstruccion }}
              </p>
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
            <section
              class="marco espacios"
              aria-labelledby="titulo-espacios"
              style="margin-top: 16px"
            >
              <h2 id="titulo-espacios">Espacios</h2>
              <p class="suave">
                Esta iglesia ofrece:
                {{ espacios(f.tiposEspacio) }}.
              </p>
              <a [routerLink]="['/espacios', f.id]">Solicitar un espacio</a>
            </section>
          }
          @if (tieneCartelera()) {
            <section
              class="marco cartelera"
              aria-labelledby="titulo-cartelera"
              style="margin-top: 16px"
            >
              <h2 id="titulo-cartelera">Anuncios y próximos eventos</h2>
              @if (cartelera()!.anuncios.length > 0) {
                <div>
                  <h3>Anuncios</h3>
                  <ul>
                    @for (a of cartelera()!.anuncios.slice(0, 3); track a.id) {
                      <li>{{ a.titulo }}</li>
                    }
                  </ul>
                </div>
              }
              @if (cartelera()!.eventosProximos.length > 0) {
                <div>
                  <h3>Próximos eventos</h3>
                  <ul>
                    @for (e of cartelera()!.eventosProximos.slice(0, 3); track e.id) {
                      <li>
                        {{ e.titulo }}
                        <span class="fecha">{{ fechaHora(e.fechaInicio) }} · {{ e.lugar }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (cartelera()!.horarios.length > 0) {
                <div>
                  <h3>Horarios de reunión</h3>
                  <ul>
                    @for (h of cartelera()!.horarios; track h.id) {
                      <li>
                        {{ dias[h.diaSemana] }} {{ h.horaInicio }}
                        <span class="fecha">{{ h.nombre }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </section>
          }
        </div>

        <div class="principal">
          <!-- E3-18 (Genaro): horario de misas, servicios y pláticas -->
          <app-misas-servicios-ficha
            [misas]="f.misas"
            [servicios]="f.servicios"
            [platicas]="f.platicas"
          />

          <section aria-labelledby="titulo-patrimonio">
            <app-titulo-colonial texto="Patrimonio" [nivel]="2" idTitulo="titulo-patrimonio" />
            @if (f.objetos.length === 0) {
              <p class="suave" style="text-align: center">
                Esta iglesia no tiene objetos vigentes registrados.
              </p>
            } @else {
              <ul class="objetos" aria-label="Objetos vigentes">
                @for (o of f.objetos; track o.id) {
                  <li class="marco">
                    <h3>{{ o.descripcion }}</h3>
                    <span class="detalle">
                      {{ tiposObjeto[o.tipo] }} · {{ o.epoca }} · {{ o.material }}
                    </span>
                    @if (o.catalogadoInah) {
                      <span class="inah">Catalogado por el INAH</span>
                    }
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      </div>
    }
  `,
})
export class FichaPage {
  readonly id = input.required<string>();
  private readonly servicio = inject(ExplorarService);

  protected readonly iconos = { ArrowLeft, CalendarDays, Mail, MapPin, Phone, Users };
  protected readonly tipos = ETIQUETAS_TIPO_IGLESIA;
  protected readonly tiposObjeto = ETIQUETAS_TIPO_OBJETO;
  protected readonly formato = formatearIndice;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly dias = DIAS_SEMANA;

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

  /**
   * Cartelera de la iglesia (E1-06b de Santiago, specs.md §12.2: «la ficha pública la enlaza»).
   * Si no responde, la ficha se muestra igual, sin esta sección.
   */
  private readonly datosCartelera = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.servicio.cartelera(params).pipe(catchError(() => of(null))),
  });
  protected readonly cartelera = computed(() => valorDe(this.datosCartelera) ?? null);
  protected readonly tieneCartelera = computed(() => {
    const c = this.cartelera();
    return Boolean(
      c && (c.anuncios.length > 0 || c.eventosProximos.length > 0 || c.horarios.length > 0),
    );
  });
  protected readonly lugar = computed(() => {
    const u = this.ficha()?.ubicacion;
    return (
      [u?.localidad?.nombre, u?.municipio?.nombre, u?.estado?.nombre]
        // Sin repetir un nombre igual al anterior («Puebla, Puebla»)
        .filter((n, i, lista) => Boolean(n) && n !== lista[i - 1])
        .join(', ')
    );
  });
  /** «Parroquia · Heroica Puebla de Zaragoza, Puebla · 1765» (en mayúsculas por CSS). */
  protected readonly subtitulo = computed(() => {
    const f = this.ficha();
    if (!f) return '';
    return [this.tipos[f.tipo], this.lugar(), f.anioConstruccion]
      .filter((p) => Boolean(p))
      .join(' · ');
  });
}
