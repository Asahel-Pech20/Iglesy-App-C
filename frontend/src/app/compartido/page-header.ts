import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Encabezado estándar de toda página: título + acciones (AGENTS.md §4 Layout).
 * Las acciones van como contenido proyectado.
 * @example <app-page-header titulo="Miembros"><button matButton="filled">Nuevo miembro</button></app-page-header>
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="encabezado">
      <div class="textos">
        <h1>{{ titulo() }}</h1>
        @if (descripcion()) {
          <p class="texto-suave">{{ descripcion() }}</p>
        }
      </div>
      <div class="acciones"><ng-content /></div>
    </div>
  `,
  styles: `
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--marco);
    }
    .textos {
      min-width: 0;
    }
    h1 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 24px;
      font-weight: 400;
      color: var(--primario);
    }
    p {
      margin: 4px 0 0;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class PageHeader {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
}
