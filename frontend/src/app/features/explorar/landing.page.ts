import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Gem, Landmark, LogIn, LucideAngularModule, MapPin, Search } from 'lucide-angular';
import { TituloColonial } from './explorar-layout';

/**
 * Página de entrada de Ecclesia para quien llega sin sesión (`/`). Presenta el sistema en el estilo
 * colonial de las pantallas públicas (E2-14) y lleva a las consultas o al acceso del personal.
 * Con sesión, `/` sigue siendo el inicio del panel (ver `sinSesion` en core/guards.ts).
 *
 * La portada lleva de fondo fotos de iglesias de México que cambian cada 7 s (`public/landing/`,
 * licencia de Unsplash). Al entrar solo se carga la primera; cada siguiente se pide antes de mostrarla.
 * Con «reducir movimiento» activado en el sistema, se queda la primera.
 */

/** Fotos del fondo: licencia gratuita de Unsplash (se agradece el crédito, que va al pie de la portada). */
export const FOTOS_PORTADA = [
  {
    archivo: 'landing/cholula-remedios.webp',
    lugar: 'Santuario de los Remedios, Cholula, Puebla',
    autor: 'Pedro Lastra',
    enlace: 'https://unsplash.com/photos/8gJqRaAaKx4',
  },
  {
    archivo: 'landing/iglesia-barroca.webp',
    lugar: 'Iglesia barroca de dos torres',
    autor: 'Francisco Fuentes',
    enlace: 'https://unsplash.com/photos/K60B0GolW40',
  },
  {
    archivo: 'landing/santiago-apoala.webp',
    lugar: 'Templo de Santiago Apoala, Oaxaca',
    autor: 'Akshay Pawar',
    enlace: 'https://unsplash.com/photos/_YPrHFLKjyg',
  },
  {
    archivo: 'landing/mamatla.webp',
    lugar: 'Iglesia de Mamatla, Estado de México',
    autor: 'Álvaro Jacobo Lagunas',
    enlace: 'https://unsplash.com/photos/A7ePTjJ81Hk',
  },
] as const;

const MS_POR_FOTO = 7000;
@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatButton, LucideAngularModule, TituloColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .portada {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin: 4px;
      padding: 40px 16px 48px;
      text-align: center;
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      overflow: hidden;
      isolation: isolate;
    }
    /* Fotos apiladas: solo la actual es opaca; el cambio es un fundido */
    .foto {
      position: absolute;
      inset: 0;
      z-index: -2;
      background-position: center;
      background-size: cover;
      opacity: 0;
      transition: opacity 1.5s ease-in-out;
    }
    .foto.visible {
      opacity: 1;
    }
    /* Velo del color de la página: más denso al centro, donde va el texto (contraste ≥ 4.5:1) */
    .velo {
      position: absolute;
      inset: 0;
      z-index: -1;
      background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--pergamino) 93%, transparent) 0%,
        color-mix(in srgb, var(--pergamino) 85%, transparent) 55%,
        color-mix(in srgb, var(--pergamino) 60%, transparent) 100%
      );
    }
    /* En pantallas angostas el texto ocupa todo el panel: velo parejo */
    @media (max-width: 767px) {
      .velo {
        background: color-mix(in srgb, var(--pergamino) 90%, transparent);
      }
    }
    .credito {
      position: absolute;
      right: 8px;
      bottom: 6px;
      margin: 0;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--texto-suave);
      background: color-mix(in srgb, var(--pergamino) 85%, transparent);
      border-radius: 4px;
    }
    .credito a {
      color: inherit;
    }
    @media (prefers-reduced-motion: reduce) {
      .foto {
        transition: none;
      }
    }
    .lema {
      margin: 0;
      padding: 2px 10px;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--acento);
      /* Sobre la foto, el dorado necesita fondo propio para llegar a 4.5:1 */
      background: color-mix(in srgb, var(--pergamino) 96%, transparent);
      border-radius: 4px;
    }
    .intro {
      max-width: 36rem;
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: var(--texto);
    }
    .botones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }
    /* Sobre la foto, el botón con borde necesita fondo propio para leerse */
    .botones a[matButton='outlined'] {
      background: var(--superficie);
    }
    .tarjetas {
      display: grid;
      gap: 16px;
      margin: 32px 0 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 768px) {
      .tarjetas {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .tarjeta-colonial {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      height: 100%;
      margin: 4px;
      padding: 20px 16px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      text-align: center;
      box-sizing: border-box;
    }
    .icono {
      color: var(--acento);
    }
    h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 19px;
      font-weight: 400;
      color: var(--primario);
    }
    .tarjeta-colonial p {
      margin: 0;
      color: var(--texto-suave);
      line-height: 1.5;
    }
    .tarjeta-colonial a {
      margin-top: auto;
      padding-top: 4px;
      font-size: 14px;
    }
    .pie {
      margin: 40px 0 0;
      padding-top: 16px;
      border-top: 1px solid var(--marco);
      font-size: 12px;
      letter-spacing: 1px;
      text-align: center;
      color: var(--texto-suave);
    }
  `,
  template: `
    <section class="portada" aria-labelledby="titulo-landing">
      @for (foto of fotos; track foto.archivo; let i = $index) {
        <div
          class="foto"
          [class.visible]="i === actual()"
          [style.background-image]="cargadas().has(i) ? 'url(' + foto.archivo + ')' : null"
          aria-hidden="true"
        ></div>
      }
      <div class="velo" aria-hidden="true"></div>
      <p class="lema">COORDINACIÓN NACIONAL DE TEMPLOS</p>
      <app-titulo-colonial
        texto="Ecclesia"
        subtitulo="Las iglesias de México y su patrimonio, en un solo lugar."
        idTitulo="titulo-landing"
      />
      <p class="intro">
        Consulta las iglesias de cada estado, conoce los objetos que guardan y cuáles tienen mayor
        valor patrimonial. El personal de cada iglesia administra aquí su información.
      </p>
      <div class="botones">
        <a matButton="filled" routerLink="/templos">
          <lucide-icon [img]="iconos.MapPin" [size]="16" aria-hidden="true" /> Explorar iglesias
        </a>
        <a matButton="outlined" routerLink="/login">
          <lucide-icon [img]="iconos.LogIn" [size]="16" aria-hidden="true" /> Acceso del personal
        </a>
      </div>
      <p class="credito">
        Foto: {{ fotoActual().lugar }} ·
        <a [href]="fotoActual().enlace" target="_blank" rel="noopener noreferrer"
          >{{ fotoActual().autor }} en Unsplash</a
        >
      </p>
    </section>

    <ul class="tarjetas" aria-label="Qué puedes hacer">
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Landmark" [size]="24" aria-hidden="true" />
          <h2>Iglesias por estado</h2>
          <p>Elige un estado y filtra por municipio, tipo de templo o capacidad.</p>
          <a routerLink="/templos">Ver iglesias</a>
        </article>
      </li>
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Gem" [size]="24" aria-hidden="true" />
          <h2>Las más reconocidas</h2>
          <p>Ordenadas por su índice de valor patrimonial, de mayor a menor.</p>
          <a routerLink="/reconocidas">Ver el ranking</a>
        </article>
      </li>
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Search" [size]="24" aria-hidden="true" />
          <h2>Búsqueda por patrimonio</h2>
          <p>Encuentra las iglesias que guardan un tipo de objeto, como retablos o pinturas.</p>
          <a routerLink="/busqueda-patrimonio">Buscar</a>
        </article>
      </li>
    </ul>

    <p class="pie">ECCLESIA · PATRIMONIO DE MÉXICO</p>
  `,
})
export class LandingPage {
  protected readonly iconos = { Gem, Landmark, LogIn, MapPin, Search };
  protected readonly fotos = FOTOS_PORTADA;
  /** Foto que se ve ahora. */
  protected readonly actual = signal(0);
  /** Fotos cuyo archivo ya se pidió: al entrar, solo la primera. */
  protected readonly cargadas = signal<ReadonlySet<number>>(new Set([0]));
  protected readonly fotoActual = computed(() => this.fotos[this.actual()] ?? this.fotos[0]);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const reducirMovimiento =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducirMovimiento) return;
      // La siguiente foto se pide a la mitad del tiempo de la actual, para que ya esté al cambiar
      const precarga = setTimeout(() => this.cargar(1), MS_POR_FOTO / 2);
      const ciclo = setInterval(() => {
        const siguiente = (this.actual() + 1) % this.fotos.length;
        this.actual.set(siguiente);
        this.cargar(siguiente + 1);
      }, MS_POR_FOTO);
      destroyRef.onDestroy(() => {
        clearTimeout(precarga);
        clearInterval(ciclo);
      });
    });
  }

  private cargar(indice: number) {
    const i = indice % this.fotos.length;
    this.cargadas.update((previas) => (previas.has(i) ? previas : new Set([...previas, i])));
  }
}
