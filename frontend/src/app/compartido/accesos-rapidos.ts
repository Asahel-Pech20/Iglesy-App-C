import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowRight, LucideAngularModule } from 'lucide-angular';
import { type EntradaMenu, MENU } from '@/app/core/menu';
import { SesionService } from '@/app/core/sesion.service';

/**
 * Mosaicos con flecha circular (los de la landing) para cada apartado que el rol puede abrir.
 * Sale del mismo menú filtrado por permisos, así que cada cuenta ve solo lo suyo.
 */
@Component({
  selector: 'app-accesos-rapidos',
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Accesos rápidos">
      <ul class="mosaicos">
        @for (e of entradas(); track e.ruta) {
          <li>
            <a class="mosaico" [routerLink]="e.ruta">
              <span class="icono" aria-hidden="true">
                <lucide-icon [img]="e.icono" [size]="20" />
              </span>
              <span class="nombre">{{ e.etiqueta }}</span>
              <span class="flecha" aria-hidden="true">
                <lucide-icon [img]="flecha" [size]="16" />
              </span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 24px;
    }
    .mosaicos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .mosaico {
      display: flex;
      height: 100%;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      box-sizing: border-box;
      border-radius: 12px;
      color: var(--primario-texto);
      background: var(--primario);
      text-decoration: none;
      transition: transform 0.15s ease;
    }
    .mosaico:hover {
      transform: translateY(-2px);
    }
    .mosaico:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 3px;
    }
    .icono {
      display: inline-flex;
      flex: none;
    }
    .nombre {
      flex: 1;
      min-width: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 17px;
    }
    .flecha {
      display: grid;
      flex: none;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--acento-texto);
      background: var(--acento);
    }
    @media (prefers-reduced-motion: reduce) {
      .mosaico {
        transition: none;
      }
    }
  `,
})
export class AccesosRapidos {
  private readonly sesion = inject(SesionService);
  protected readonly flecha = ArrowRight;
  /** Los apartados del menú que este rol puede abrir, sin «Inicio». */
  protected readonly entradas = computed(() =>
    MENU.filter(
      (e: EntradaMenu) =>
        e.ruta !== '/' && !e.pendiente && (!e.permiso || this.sesion.puede(...[e.permiso].flat())),
    ),
  );
}
