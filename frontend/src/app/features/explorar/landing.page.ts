import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowRight, LogIn, LucideAngularModule, MapPin } from 'lucide-angular';
import { FOTOS_IGLESIAS } from './fotos-iglesias';

/**
 * Página de entrada de Ecclesia para quien llega sin sesión (`/`). Presenta el sistema en el estilo
 * colonial de las pantallas públicas (E2-14) y lleva a las consultas o al acceso del personal.
 * Con sesión, `/` sigue siendo el inicio del panel (ver `sinSesion` en core/guards.ts).
 *
 * La portada lleva de fondo fotos de iglesias de México que cambian cada 7 s (`public/landing/`,
 * licencia de Unsplash). Al entrar solo se carga la primera; cada siguiente se pide antes de mostrarla.
 * Con «reducir movimiento» activado en el sistema, se queda la primera.
 */

/** Fotos del fondo (se exporta con este nombre para las pruebas). */
export const FOTOS_PORTADA = FOTOS_IGLESIAS;

const MS_POR_FOTO = 7000;

/** Accesos de la parte baja: las tres consultas públicas. */
const MOSAICOS = [
  {
    ruta: '/templos',
    titulo: 'Iglesias por estado',
    detalle: 'Filtra por municipio, tipo de templo o capacidad.',
  },
  {
    ruta: '/reconocidas',
    titulo: 'Las más reconocidas',
    detalle: 'Ordenadas por su índice de valor patrimonial.',
  },
  {
    ruta: '/busqueda-patrimonio',
    titulo: 'Búsqueda por patrimonio',
    detalle: 'Retablos, pinturas, imágenes y más.',
  },
] as const;

@Component({
  selector: 'app-landing',
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    /* ── Portada: foto grande con el título abajo a la izquierda ── */
    /* De orilla a orilla y debajo de la barra flotante (--alto-barra viene del marco público) */
    .portada {
      position: relative;
      display: flex;
      min-height: 520px;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 12px;
      margin: calc(-1 * (var(--alto-barra) + 12px)) calc((100% - 100cqi) / 2) 0;
      padding: calc(var(--alto-barra) + 40px) max(24px, calc((100cqi - 64rem) / 2 + 16px)) 32px;
      overflow: hidden;
      isolation: isolate;
      color: var(--foto-texto);
    }
    @media (min-width: 768px) {
      .portada {
        min-height: 640px;
        padding-bottom: 64px;
      }
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
    /* Velo del color primario: denso abajo, donde va el texto (contraste ≥ 4.5:1), ligero arriba */
    .velo {
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        linear-gradient(
          to right,
          color-mix(in srgb, var(--foto-sombra) 75%, transparent) 0%,
          color-mix(in srgb, var(--foto-sombra) 55%, transparent) 50%,
          transparent 85%
        ),
        linear-gradient(
          to top,
          color-mix(in srgb, var(--foto-sombra) 70%, transparent) 0%,
          color-mix(in srgb, var(--foto-sombra) 30%, transparent) 55%,
          transparent 100%
        );
    }
    /* En celular el texto ocupa todo el ancho: sombra pareja */
    @media (max-width: 767px) {
      .velo {
        background: color-mix(in srgb, var(--foto-sombra) 72%, transparent);
      }
    }
    .credito {
      position: absolute;
      right: 12px;
      bottom: 12px;
      margin: 0;
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 999px;
      color: var(--foto-texto);
      background: color-mix(in srgb, var(--foto-sombra) 80%, transparent);
    }
    .credito a {
      color: inherit;
    }
    /* En celular el texto llena la portada: el crédito baja, debajo de los botones */
    @media (max-width: 767px) {
      .credito {
        position: static;
        margin-top: 8px;
      }
    }
    .lema {
      margin: 0;
      font-size: 12px;
      letter-spacing: 3px;
    }
    .portada h1 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 48px;
      font-weight: 400;
      line-height: 1.05;
      color: inherit;
    }
    @media (min-width: 768px) {
      .portada h1 {
        font-size: 76px;
      }
    }
    .lema-grande {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 20px;
    }
    /* Filete dorado (decorativo) */
    .filete {
      display: block;
      width: 64px;
      height: 3px;
      border-radius: 2px;
      background: var(--acento);
    }
    .intro {
      max-width: 36rem;
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
    }
    .botones {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 8px;
    }
    /* Botones en forma de píldora */
    .boton {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 22px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
    }
    .boton:focus-visible,
    .mosaico:focus-visible,
    .enlace-boton:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 3px;
    }
    .boton-principal {
      color: var(--acento-texto);
      background: var(--acento);
    }
    .boton-secundario {
      color: var(--foto-texto);
      border: 1px solid var(--foto-texto);
    }
    @media (prefers-reduced-motion: reduce) {
      .foto {
        transition: none;
      }
    }

    /* ── Bienvenida: texto y foto en dos columnas ── */
    .bienvenida {
      display: grid;
      gap: 24px;
      align-items: center;
      margin: 40px 0 0;
      padding: 32px 24px;
      border-radius: 16px;
      background: var(--superficie);
      border: 1px solid var(--marco);
    }
    @media (min-width: 768px) {
      .bienvenida {
        grid-template-columns: 1fr 1fr;
        padding: 48px;
      }
    }
    .bienvenida h2 {
      margin: 0 0 12px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 32px;
      font-weight: 400;
      line-height: 1.15;
      color: var(--primario);
    }
    .bienvenida p {
      margin: 0 0 12px;
      line-height: 1.6;
      color: var(--texto);
    }
    .enlace-boton {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      padding: 10px 20px;
      border-radius: 999px;
      font-weight: 500;
      text-decoration: none;
      color: var(--primario-texto);
      background: var(--primario);
    }
    .bienvenida img {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 12px;
    }

    /* ── Mosaicos con flecha circular ── */
    .mosaicos {
      display: grid;
      gap: 12px;
      margin: 32px 0 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 768px) {
      .mosaicos {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .mosaico {
      display: flex;
      height: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 20px;
      border-radius: 12px;
      box-sizing: border-box;
      color: var(--primario-texto);
      background: var(--primario);
      text-decoration: none;
    }
    .mosaico h2 {
      margin: 0 0 4px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 20px;
      font-weight: 400;
    }
    .mosaico p {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
    }
    .flecha {
      display: grid;
      flex: none;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      color: var(--acento-texto);
      background: var(--acento);
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
      <h1 id="titulo-landing">Ecclesia</h1>
      <p class="lema-grande">Las iglesias de México y su patrimonio, en un solo lugar.</p>
      <span class="filete" aria-hidden="true"></span>
      <p class="intro">
        Consulta las iglesias de cada estado, conoce los objetos que guardan y cuáles tienen mayor
        valor patrimonial. El personal de cada iglesia administra aquí su información.
      </p>
      <div class="botones">
        <a class="boton boton-principal" routerLink="/templos">
          <lucide-icon [img]="iconos.MapPin" [size]="18" aria-hidden="true" /> Explorar iglesias
        </a>
        <a class="boton boton-secundario" routerLink="/login">
          <lucide-icon [img]="iconos.LogIn" [size]="18" aria-hidden="true" /> Acceso del personal
        </a>
      </div>
      <p class="credito">
        Foto: {{ fotoActual().lugar }} ·
        <a [href]="fotoActual().enlace" target="_blank" rel="noopener noreferrer"
          >{{ fotoActual().autor }} en Unsplash</a
        >
      </p>
    </section>

    <section class="bienvenida" aria-labelledby="titulo-bienvenida">
      <div>
        <h2 id="titulo-bienvenida">Desde las catedrales hasta las capillas de pueblo</h2>
        <p>
          La Coordinación Nacional de Templos reúne aquí el registro de las iglesias del país: dónde
          están, qué patrimonio resguardan, sus horarios de misa, sus servicios y sus pláticas.
        </p>
        <p>Elige tu estado para empezar, o mira cuáles son las iglesias más reconocidas.</p>
        <a class="enlace-boton" routerLink="/reconocidas">
          Ver las más reconocidas
          <lucide-icon [img]="iconos.ArrowRight" [size]="16" aria-hidden="true" />
        </a>
      </div>
      <img
        [src]="fotoBienvenida.archivo"
        [alt]="fotoBienvenida.lugar"
        loading="lazy"
        width="1600"
        height="1200"
      />
    </section>

    <ul class="mosaicos" aria-label="Qué puedes hacer">
      @for (m of mosaicos; track m.ruta) {
        <li>
          <a class="mosaico" [routerLink]="m.ruta">
            <div>
              <h2>{{ m.titulo }}</h2>
              <p>{{ m.detalle }}</p>
            </div>
            <span class="flecha" aria-hidden="true">
              <lucide-icon [img]="iconos.ArrowRight" [size]="20" />
            </span>
          </a>
        </li>
      }
    </ul>

    <p class="pie">ECCLESIA · PATRIMONIO DE MÉXICO</p>
  `,
})
export class LandingPage {
  protected readonly iconos = { ArrowRight, LogIn, MapPin };
  protected readonly mosaicos = MOSAICOS;
  /** Foto de la sección de bienvenida: la de Mamatla, que no abre la portada. */
  protected readonly fotoBienvenida = FOTOS_PORTADA[3];
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
