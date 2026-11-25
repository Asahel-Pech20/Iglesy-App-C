import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Church, LucideAngularModule } from 'lucide-angular';
import { ConfiguracionService } from '@/app/features/configuracion/configuracion.service';
import { SesionService } from '@/app/core/sesion.service';

/** Logo + nombre de la iglesia (de la configuración). */
@Component({
  selector: 'app-marca-iglesia',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="marca" [class.grande]="grande()">
      @if (config()?.logoUrl; as logo) {
        <img [src]="logo" alt="" class="logo" />
      } @else {
        <span class="logo icono" aria-hidden="true">
          <lucide-icon [img]="iglesia" [size]="grande() ? 28 : 20" />
        </span>
      }
      <span class="nombre" [title]="nombre()">{{ nombre() }}</span>
    </div>
  `,
  styles: `
    /* En la barra móvil el nombre se recorta con «…» en vez de empujar los botones fuera */
    :host {
      display: block;
      min-width: 0;
    }
    .marca {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 12px;
    }
    .grande {
      flex-direction: column;
    }
    .logo {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 4px;
      object-fit: contain;
    }
    .grande .logo {
      width: 56px;
      height: 56px;
    }
    .icono {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primario);
      color: var(--primario-texto);
    }
    .nombre {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      font-size: 17px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grande .nombre {
      font-size: 22px;
      color: var(--primario);
      text-align: center;
      white-space: normal;
    }
  `,
})
export class MarcaIglesia {
  readonly grande = input(false);
  private readonly configuracion = inject(ConfiguracionService);
  protected readonly config = this.configuracion.actual;
  private readonly sesion = inject(SesionService);
  /** E1-06b: la Coordinación no tiene iglesia propia, así que su marca es la nacional */
  protected readonly nombre = computed(() => {
    const config = this.config();
    if (config) return config.nombre;
    const esNacional = this.sesion.estado() === 'autenticado' && !this.sesion.iglesia();
    return esNacional ? 'Coordinación Nacional' : 'AppIglesia';
  });
  protected readonly iglesia = Church;

  constructor() {
    this.configuracion.cargar();
  }
}
