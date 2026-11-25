import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AdornoColonial } from '@/app/compartido/adorno-colonial';

/**
 * Encabezado estándar de toda página: título + acciones (AGENTS.md §4 Layout).
 * Las acciones van como contenido proyectado.
 * @example <app-page-header titulo="Miembros"><button matButton="filled">Nuevo miembro</button></app-page-header>
 */
@Component({
  selector: 'app-page-header',
  imports: [AdornoColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="encabezado">
      <div class="textos">
        <h1>{{ titulo() }}</h1>
        <app-adorno-colonial />
        @if (descripcion()) {
          <p class="texto-suave">{{ descripcion() }}</p>
        }
      </div>
      <div class="acciones"><ng-content /></div>
    </div>
  `,
  styles: `
    /* Estilo colonial: título centrado con el adorno de cruz, como las pantallas públicas */
    .encabezado {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .textos {
      min-width: 0;
      text-align: center;
    }
    /* Desde 768 px las acciones van a la derecha sin descentrar el título */
    @media (min-width: 768px) {
      .encabezado {
        grid-template-columns: 1fr minmax(0, auto) 1fr;
        align-items: start;
      }
      .textos {
        grid-column: 2;
      }
      .acciones {
        grid-column: 3;
        justify-self: end;
      }
    }
    h1 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: 400;
      color: var(--primario);
      overflow-wrap: anywhere;
    }
    p {
      margin: 8px 0 0;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .acciones:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
}
