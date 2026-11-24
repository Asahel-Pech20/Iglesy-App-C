import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Cross, LogIn, LucideAngularModule } from 'lucide-angular';

/**
 * Título de página del estilo colonial (E2-14): centrado, en serifa y con un adorno debajo
 * (dos líneas --marco y una cruz en --acento). `nivel` 2 lo usa la ficha para sus secciones.
 */
@Component({
  selector: 'app-titulo-colonial',
  imports: [LucideAngularModule],
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
    .adorno {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 14rem;
      margin: 8px auto 0;
      color: var(--acento);
    }
    .adorno::before,
    .adorno::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--marco);
    }
    .subtitulo {
      margin: 8px 0 0;
      color: var(--texto-suave);
    }
  `,
  template: `
    @if (nivel() === 1) {
      <h1>{{ texto() }}</h1>
    } @else {
      <h2 [id]="idTitulo()">{{ texto() }}</h2>
    }
    <div class="adorno" aria-hidden="true">
      <lucide-icon [img]="iconos.Cross" [size]="14" />
    </div>
    @if (subtitulo()) {
      <p class="subtitulo">{{ subtitulo() }}</p>
    }
  `,
})
export class TituloColonial {
  readonly texto = input.required<string>();
  readonly subtitulo = input<string>();
  readonly nivel = input<1 | 2>(1);
  readonly idTitulo = input<string | undefined>(undefined);
  protected readonly iconos = { Cross };
}

/**
 * Marco de las pantallas públicas de Ecclesia (E2-14), en estilo colonial: fondo pergamino, barra
 * azul con doble borde dorado. Sin sesión y pensado para el celular (360 px, RNF-02).
 */
@Component({
  selector: 'app-explorar-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--pergamino);
      color: var(--texto);
    }
    header {
      background: var(--primario);
      color: var(--primario-texto);
      border-bottom: 3px double var(--acento);
    }
    .barra,
    main {
      max-width: 64rem;
      margin: 0 auto;
      padding: 12px 16px;
    }
    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
    }
    .marca {
      color: var(--primario-texto);
      text-decoration: none;
      line-height: 1.2;
    }
    .nombre {
      display: block;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 20px;
      letter-spacing: 1px;
    }
    .lema {
      display: block;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--marco);
    }
    /* En oscuro la barra es azul claro: --marco solo daba 4.72:1 a 11 px (revisión de Santiago en el
       PR #28). Se usa --primario-texto (9.9:1) sin oscurecer --marco, que también dibuja los marcos. */
    :host-context(.dark) .lema {
      color: var(--primario-texto);
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: 14px;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--primario-texto);
      text-decoration: none;
      padding: 4px 0;
      border-bottom: 2px solid transparent;
    }
    nav a.activo {
      border-bottom-color: var(--marco);
    }
    main {
      padding-bottom: 32px;
    }
  `,
  template: `
    <header>
      <div class="barra">
        <a class="marca" routerLink="/templos">
          <span class="nombre">Ecclesia</span>
          <span class="lema">PATRIMONIO DE MÉXICO</span>
        </a>
        <nav aria-label="Consultas públicas">
          <a routerLink="/templos" routerLinkActive="activo">Iglesias</a>
          <a routerLink="/reconocidas" routerLinkActive="activo">Más reconocidas</a>
          <a routerLink="/busqueda-patrimonio" routerLinkActive="activo">Búsqueda</a>
          <a routerLink="/login">
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
