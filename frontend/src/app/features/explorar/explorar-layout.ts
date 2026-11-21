import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Church, LogIn, LucideAngularModule } from 'lucide-angular';

/**
 * Marco de las pantallas públicas de Ecclesia (E2-14): sin sesión y pensado para el celular
 * (360 px sin desplazamiento horizontal, RNF-02).
 */
@Component({
  selector: 'app-explorar-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--fondo);
      color: var(--texto);
    }
    header {
      border-bottom: 1px solid var(--borde);
      background: var(--superficie);
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
      gap: 8px;
    }
    .marca {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 18px;
      color: var(--primario);
      text-decoration: none;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: 14px;
    }
    nav a {
      color: var(--texto-suave);
      text-decoration: none;
      padding: 4px 0;
    }
    nav a.activo {
      color: var(--primario);
      font-weight: 600;
    }
    main {
      padding-bottom: 32px;
    }
  `,
  template: `
    <header>
      <div class="barra">
        <a class="marca" routerLink="/templos">
          <lucide-icon [img]="iconos.Church" [size]="20" aria-hidden="true" /> Ecclesia
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
  protected readonly iconos = { Church, LogIn };
}
