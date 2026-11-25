import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Cross, LucideAngularModule } from 'lucide-angular';

/**
 * Adorno del estilo colonial (NAT-01): dos líneas --marco con una cruz en --acento al centro.
 * Es decorativo (aria-hidden). Lo usan los títulos públicos, el encabezado de página, el login
 * y los marcos públicos, para que toda la app tenga el mismo detalle.
 */
@Component({
  selector: 'app-adorno-colonial',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<lucide-icon [img]="cruz" [size]="14" />`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 14rem;
      margin: 8px auto 0;
      color: var(--acento);
    }
    :host::before,
    :host::after {
      content: '';
      flex: 1;
      border-top: 1px solid var(--marco);
    }
  `,
})
export class AdornoColonial {
  protected readonly cruz = Cross;
}
