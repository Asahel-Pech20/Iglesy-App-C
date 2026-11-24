import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogIn, LucideAngularModule } from 'lucide-angular';

/** Marco de las pantallas públicas de espacios: sin menú lateral ni sesión, legible en celular. */
@Component({
  selector: 'app-marco-publico',
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="marco">
      <header class="encabezado">
        <div class="contenido">
          <div>
            <h1>{{ titulo() }}</h1>
            @if (subtitulo()) {
              <p class="texto-suave">{{ subtitulo() }}</p>
            }
          </div>
          <a routerLink="/login" class="acceso">
            <lucide-icon [img]="iconos.LogIn" [size]="16" aria-hidden="true" /> Acceso del personal
          </a>
        </div>
      </header>
      <main class="principal"><ng-content /></main>
    </div>
  `,
  styles: `
    /* Estilo colonial, igual que las pantallas públicas de iglesias (explorar/) */
    .marco {
      min-height: 100dvh;
      background: var(--pergamino);
      color: var(--texto);
    }
    .encabezado {
      border-bottom: 3px double var(--acento);
      background: var(--primario);
      color: var(--primario-texto);
    }
    .contenido {
      display: flex;
      max-width: 44rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 auto;
      padding: 16px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
    }
    p {
      margin: 0;
      font-size: 14px;
    }
    .encabezado .texto-suave {
      color: var(--primario-texto);
    }
    .acceso {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: var(--primario-texto);
    }
    .principal {
      display: flex;
      max-width: 44rem;
      flex-direction: column;
      gap: 16px;
      margin: 0 auto;
      padding: 16px;
    }
  `,
})
export class MarcoPublico {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  protected readonly iconos = { LogIn };
}
