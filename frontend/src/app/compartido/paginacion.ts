import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';
import type { MetaPaginacion } from '@/app/tipos/comunes';

/** Controles de paginación para listados (`meta` del contrato). */
@Component({
  selector: 'app-paginacion',
  imports: [MatButton, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta().total > 0) {
      <nav aria-label="Paginación" class="paginacion">
        <p class="texto-suave">{{ desde() }}–{{ hasta() }} de {{ meta().total }}</p>
        <div class="controles">
          <button
            matButton="outlined"
            type="button"
            [disabled]="meta().page <= 1"
            (click)="cambio.emit(meta().page - 1)"
          >
            <lucide-icon [img]="izquierda" [size]="16" aria-hidden="true" />
            <span class="etiqueta">Anterior</span>
          </button>
          <span aria-current="page" class="actual">
            <span class="corto" aria-hidden="true">{{ meta().page }} / {{ totalPaginas() }}</span>
            <span class="largo">Página {{ meta().page }} de {{ totalPaginas() }}</span>
          </span>
          <button
            matButton="outlined"
            type="button"
            [disabled]="meta().page >= meta().totalPages"
            (click)="cambio.emit(meta().page + 1)"
          >
            <span class="etiqueta">Siguiente</span>
            <lucide-icon [img]="derecha" [size]="16" aria-hidden="true" />
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    .paginacion {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--borde);
    }
    p {
      margin: 0;
    }
    .controles {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    button {
      flex-shrink: 0;
      white-space: nowrap;
    }
    /* Celular (< 480 px): solo las flechas, para que la paginación quepa en un renglón.
       El texto sigue para lectores de pantalla. */
    @media (max-width: 479.98px) {
      button {
        min-width: 40px;
        padding-inline: 8px;
      }
      .etiqueta {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }
    }
    .actual {
      white-space: nowrap;
    }
    /* En móvil el texto corto para que no se parta entre los botones (A1-F1-02) */
    .largo {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    @media (min-width: 640px) {
      .corto {
        display: none;
      }
      .largo {
        position: static;
        width: auto;
        height: auto;
        clip: auto;
      }
    }
  `,
})
export class Paginacion {
  readonly meta = input.required<MetaPaginacion>();
  readonly cambio = output<number>();
  protected readonly desde = computed(() => (this.meta().page - 1) * this.meta().limit + 1);
  protected readonly hasta = computed(() =>
    Math.min(this.meta().page * this.meta().limit, this.meta().total),
  );
  protected readonly totalPaginas = computed(() => Math.max(this.meta().totalPages, 1));
  protected readonly izquierda = ChevronLeft;
  protected readonly derecha = ChevronRight;
}
