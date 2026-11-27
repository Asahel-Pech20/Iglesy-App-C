import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FOTOS_IGLESIAS, type FotoIglesia } from '@/app/features/explorar/fotos-iglesias';

/**
 * Encabezado estándar de toda página: título + acciones (AGENTS.md §4 Layout).
 * Con el estilo de la landing: una banda redondeada con la foto de una iglesia, sombra oscura y el
 * título en blanco. Las acciones van debajo, a la derecha, sobre el fondo normal (así los botones
 * conservan su contraste).
 * @example <app-page-header titulo="Miembros"><button matButton="filled">Nuevo miembro</button></app-page-header>
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banda" [style.background-image]="'url(' + foto().archivo + ')'">
      <h1>{{ titulo() }}</h1>
      <span class="filete" aria-hidden="true"></span>
      @if (descripcion()) {
        <p>{{ descripcion() }}</p>
      }
      <p class="credito">
        Foto:
        <a [href]="foto().enlace" target="_blank" rel="noopener noreferrer">{{ foto().autor }}</a>
        en Unsplash
      </p>
    </div>
    <div class="acciones"><ng-content /></div>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 24px;
    }
    .banda {
      position: relative;
      isolation: isolate;
      display: flex;
      min-height: 140px;
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
      padding: 32px 24px 20px;
      overflow: hidden;
      border-radius: 16px;
      color: var(--foto-texto);
      background-color: var(--foto-sombra);
      background-position: center;
      background-size: cover;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
    }
    /* Sombra pareja: texto blanco con contraste ≥ 4.5:1 sobre cualquier parte de la foto */
    .banda::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: color-mix(in srgb, var(--foto-sombra) 72%, transparent);
    }
    h1 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 30px;
      font-weight: 400;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .filete {
      width: 56px;
      height: 3px;
      border-radius: 2px;
      background: var(--acento);
    }
    p {
      margin: 0;
      max-width: 48rem;
    }
    .credito {
      font-size: 11px;
    }
    .credito a {
      color: inherit;
    }
    @media (min-width: 768px) {
      .banda {
        padding: 40px 32px 24px;
      }
      .credito {
        position: absolute;
        right: 12px;
        bottom: 10px;
        padding: 2px 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foto-sombra) 80%, transparent);
      }
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    .acciones:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  /** Foto de fondo de la banda; por omisión, la de la iglesia barroca de la landing. */
  readonly foto = input<FotoIglesia>(FOTOS_IGLESIAS[1]);
}
