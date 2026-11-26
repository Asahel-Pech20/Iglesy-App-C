import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogIn, LucideAngularModule } from 'lucide-angular';
import { AdornoColonial } from '@/app/compartido/adorno-colonial';
import type { FotoIglesia } from './fotos-iglesias';

/**
 * Título de página del estilo colonial (E2-14): centrado, en serifa y con un adorno debajo
 * (dos líneas --marco y una cruz en --acento). `nivel` 2 lo usa la ficha para sus secciones.
 * Con `foto`, el título de página es una banda de portada de orilla a orilla, como la landing.
 */
@Component({
  selector: 'app-titulo-colonial',
  imports: [AdornoColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      text-align: center;
      margin: 8px 0 16px;
    }
    h1,
    h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
      overflow-wrap: anywhere;
    }
    h1 {
      font-size: 26px;
    }
    h2 {
      font-size: 20px;
    }
    .subtitulo {
      margin: 8px 0 0;
      color: var(--texto-suave);
    }
    /* ── Con foto: banda de orilla a orilla, debajo de la barra flotante, título abajo a la izquierda.
       El ancho sale del marco público (container-type en styles.scss) ── */
    :host(.con-foto) {
      margin: calc(-1 * (var(--alto-barra, 0px) + 12px)) calc((100% - 100cqi) / 2) 24px;
      text-align: left;
    }
    .banda {
      position: relative;
      display: flex;
      min-height: 300px;
      box-sizing: border-box;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 10px;
      padding: calc(var(--alto-barra, 0px) + 32px) max(24px, calc((100cqi - 64rem) / 2 + 16px)) 40px;
      overflow: hidden;
      isolation: isolate;
      color: var(--foto-texto);
      background-position: center;
      background-size: cover;
    }
    @media (min-width: 768px) {
      .banda {
        min-height: 360px;
      }
    }
    /* Sombra oscura abajo y a la izquierda, donde va el texto */
    .banda::before {
      content: '';
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
    @media (max-width: 767px) {
      .banda::before {
        background: color-mix(in srgb, var(--foto-sombra) 72%, transparent);
      }
    }
    .banda h1 {
      font-size: 36px;
      line-height: 1.1;
      color: inherit;
    }
    @media (min-width: 768px) {
      .banda h1 {
        font-size: 48px;
      }
    }
    .banda .subtitulo {
      max-width: 36rem;
      margin: 0;
      font-size: 17px;
      color: inherit;
    }
    .filete {
      display: block;
      width: 56px;
      height: 3px;
      border-radius: 2px;
      background: var(--acento);
    }
    .credito {
      position: absolute;
      right: 12px;
      bottom: 12px;
      margin: 0;
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--foto-sombra) 80%, transparent);
    }
    .credito a {
      color: inherit;
    }
    @media (max-width: 767px) {
      .credito {
        position: static;
        margin-top: 6px;
      }
    }
  `,
  host: { '[class.con-foto]': 'conFoto()' },
  template: `
    @if (conFoto() && foto(); as f) {
      <div class="banda" [style.background-image]="'url(' + f.archivo + ')'">
        <h1>{{ texto() }}</h1>
        <span class="filete" aria-hidden="true"></span>
        @if (subtitulo()) {
          <p class="subtitulo">{{ subtitulo() }}</p>
        }
        <p class="credito">
          Foto: {{ f.lugar }} ·
          <a [href]="f.enlace" target="_blank" rel="noopener noreferrer"
            >{{ f.autor }} en Unsplash</a
          >
        </p>
      </div>
    } @else {
      @if (nivel() === 1) {
        <h1>{{ texto() }}</h1>
      } @else {
        <h2 [id]="idTitulo()">{{ texto() }}</h2>
      }
      <app-adorno-colonial />
      @if (subtitulo()) {
        <p class="subtitulo">{{ subtitulo() }}</p>
      }
    }
  `,
})
export class TituloColonial {
  readonly texto = input.required<string>();
  readonly subtitulo = input<string>();
  readonly nivel = input<1 | 2>(1);
  readonly idTitulo = input<string | undefined>(undefined);
  /** Con foto, el título de página (nivel 1) se muestra como banda de portada sobre ella. */
  readonly foto = input<FotoIglesia | undefined>(undefined);
  protected readonly conFoto = computed(() => this.nivel() === 1 && this.foto() !== undefined);
}

/**
 * Marco de las pantallas públicas de Ecclesia (E2-14): fondo pergamino y barra flotante en forma
 * de píldora translúcida, fija arriba. Sin sesión y pensado para el celular (360 px, RNF-02).
 */
@Component({
  selector: 'app-explorar-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* La barra flota sobre el contenido: --alto-barra es el espacio que deja arriba (lo usan main y
       las portadas con foto para meterse debajo de ella) */
    :host {
      --alto-barra: 92px;
      display: block;
      min-height: 100dvh;
      background: var(--pergamino);
      color: var(--texto);
    }
    @media (max-width: 767px) {
      :host {
        --alto-barra: 104px;
      }
    }
    /* ── Barra: píldora translúcida fija arriba ── */
    header {
      position: fixed;
      top: 12px;
      right: 0;
      left: 0;
      z-index: 20;
      padding: 0 12px;
      pointer-events: none;
    }
    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      max-width: 64rem;
      margin: 0 auto;
      padding: 10px 12px 10px 24px;
      box-sizing: border-box;
      border-radius: 28px;
      /* Vidrio esmerilado: lo de abajo se difumina y el texto se sigue leyendo sobre una foto */
      background: color-mix(in srgb, var(--pergamino) 90%, transparent);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      box-shadow: 0 4px 18px rgb(0 0 0 / 0.18);
      pointer-events: auto;
    }
    .marca {
      color: var(--primario);
      text-decoration: none;
      line-height: 1.2;
    }
    .nombre {
      display: block;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 20px;
      letter-spacing: 1px;
    }
    /* El dorado no llega a 4.5:1 a 11 px si debajo pasa una foto oscura; el gris suave sí */
    .lema {
      display: block;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--texto-suave);
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 20px;
      font-size: 15px;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
      color: var(--texto);
      font-weight: 500;
      text-decoration: none;
      border-bottom: 2px solid transparent;
    }
    nav a.activo {
      border-bottom-color: var(--acento);
    }
    /* «Personal» como botón píldora */
    nav a.personal {
      padding: 8px 18px;
      border: none;
      border-radius: 999px;
      color: var(--acento-texto);
      background: var(--acento);
    }
    nav a:focus-visible,
    .marca:focus-visible {
      outline: 2px solid var(--anillo);
      outline-offset: 2px;
    }
    main {
      max-width: 64rem;
      margin: 0 auto;
      padding: calc(var(--alto-barra) + 12px) 16px 32px;
    }
    /* En celular: arriba la marca con «Personal» a la derecha; abajo las tres consultas en un
       renglón (si no caben, se deslizan de lado en vez de empujar la página) */
    @media (max-width: 767px) {
      header {
        top: 8px;
        padding: 0 8px;
      }
      .barra {
        position: relative;
        gap: 4px;
        padding: 8px 12px;
        border-radius: 20px;
      }
      nav {
        width: 100%;
        flex-wrap: nowrap;
        gap: 16px;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: none;
      }
      nav a.personal {
        position: absolute;
        top: 10px;
        right: 12px;
        padding: 6px 14px;
      }
    }
  `,
  template: `
    <header>
      <div class="barra">
        <a class="marca" routerLink="/">
          <span class="nombre">Ecclesia</span>
          <span class="lema">PATRIMONIO DE MÉXICO</span>
        </a>
        <nav aria-label="Consultas públicas">
          <a routerLink="/templos" routerLinkActive="activo">Iglesias</a>
          <a routerLink="/reconocidas" routerLinkActive="activo">Más reconocidas</a>
          <a routerLink="/busqueda-patrimonio" routerLinkActive="activo">Búsqueda</a>
          <a class="personal" routerLink="/login">
            <lucide-icon [img]="iconos.LogIn" [size]="14" aria-hidden="true" /> Personal
          </a>
        </nav>
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class ExplorarLayout {
  protected readonly iconos = { LogIn };
}
