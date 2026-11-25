import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';

/**
 * Tarjeta de indicador (cifra grande + título + ícono). La descripción va como contenido proyectado.
 * @example <app-stat-card titulo="Miembros activos" valor="120" [icono]="Users" />
 */
@Component({
  selector: 'app-stat-card',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="tarjeta cuerpo">
      <div class="cabecera">
        <p class="titulo texto-suave">{{ titulo() }}</p>
        <lucide-icon [img]="icono()" [size]="20" class="texto-suave" aria-hidden="true" />
      </div>
      @if (cargando()) {
        <span class="cargando" role="status" aria-label="Cargando"></span>
      } @else {
        <p class="valor">{{ valor() }}</p>
        <div class="descripcion texto-suave"><ng-content /></div>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .cuerpo {
      display: flex;
      height: 100%;
      flex-direction: column;
      gap: 4px;
      padding: 16px;
    }
    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    p {
      margin: 0;
    }
    .titulo {
      font-size: 14px;
    }
    .valor {
      font-size: 28px;
      font-weight: 300;
      letter-spacing: -0.5px;
      font-variant-numeric: tabular-nums;
      color: var(--primario);
    }
    .descripcion {
      font-size: 12px;
    }
    .descripcion:empty {
      display: none;
    }
    .cargando {
      display: block;
      width: 6rem;
      height: 32px;
      border-radius: 4px;
      background: var(--superficie-suave);
    }
  `,
})
export class StatCard {
  readonly titulo = input.required<string>();
  readonly valor = input<string>();
  readonly icono = input.required<LucideIconData>();
  readonly cargando = input(false);
}
